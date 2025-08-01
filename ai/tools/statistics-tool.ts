'use server';

/**
 * @fileOverview A Genkit tool for performing statistical analyses using a Node.js library.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { executeQuery } from '@/lib/data-service';
import MultivariateLinearRegression from 'ml-regression-multivariate-linear';
import { RandomForestRegression } from 'ml-random-forest';

const toolInputSchema = z.object({
  analysisType: z.enum(['linearRegression', 'randomForestRegression']).describe("The type of regression to perform. Use 'linearRegression' for simple relationships and 'randomForestRegression' for more complex, potentially non-linear models."),
  target: z.string().describe('The target (dependent) variable for the analysis. Must be a single column name.'),
  features: z.array(z.string()).describe('A list of one or more feature (independent) variables. Must be column names.'),
  filters: z.record(z.string(), z.any()).optional().describe('Key-value pairs to filter the dataset. E.g., { "cntry": "DE" }.'),
  codebookContext: z.string().describe('Relevant context from the database codebook.'),
});

const toolOutputSchema = z.object({
  sqlQuery: z.string().optional().describe("The SQL query used to fetch the data for analysis."),
  result: z.any().optional().describe("The result of the statistical analysis."),
  error: z.string().optional().describe("An error message if the analysis failed, possibly containing debug logs."),
});

export const statisticsTool = ai.defineTool(
  {
    name: 'statisticsTool',
    description: "Use this tool to perform regression analysis. Choose 'linearRegression' for simple models or 'randomForestRegression' for more complex, non-linear relationships. Provide a target variable, feature variables, and optional filters.",
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery = '';
    const logs: string[] = [`[statisticsTool] Starting ${input.analysisType} analysis for target '${input.target}' with features [${input.features.join(', ')}]`];

    try {
      // 1. Construct the SQL query to fetch raw data
      logs.push('Step 1: Constructing SQL query...');
      const allColumns = Array.from(new Set([input.target, ...input.features]));
      sqlQuery = `SELECT ${allColumns.map(c => `"${c}"`).join(', ')} FROM "ESS1"`;

      const whereClauses: string[] = [];
      if (input.filters) {
        for (const [key, value] of Object.entries(input.filters)) {
          whereClauses.push(`"${key}" = '${value}'`);
        }
        logs.push(`Added user-defined filters: ${JSON.stringify(input.filters)}`);
      }

      // Add generic filters to exclude common missing values
      for (const col of allColumns) {
         if (col === 'gndr') {
            whereClauses.push(`"gndr" IN ('1','2')`);
         } else {
            whereClauses.push(`"${col}" NOT IN ('7', '8', '9', '77', '88', '99', '777', '888', '999', '9999')`);
         }
      }
      logs.push('Added generic filters for missing values.');

      if (whereClauses.length > 0) {
        sqlQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      logs.push(`Step 1 Complete: Final SQL Query: ${sqlQuery}`);

      // 2. Fetch data from Supabase
      logs.push('Step 2: Fetching data from Supabase...');
      const { data: queryData, error: queryError } = await executeQuery(sqlQuery);

      if (queryError) {
        logs.push(`❌ SQL query failed: ${queryError}`);
        console.error('[statisticsTool] Error fetching data:', queryError);
        return { error: logs.join('\n'), sqlQuery };
      }
      if (!queryData || queryData.length === 0) {
        logs.push('❌ No data available for analysis after filtering.');
        console.warn(logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }
      logs.push(`Step 2 Complete: Successfully fetched ${queryData.length} rows.`);
      
      // 3. Transform data for the regression library
      logs.push('Step 3: Transforming data for regression library...');
      const typedRows: Record<string, number>[] = [];
      for (const raw of queryData) {
        const row: Record<string, number> = {};
        let ok = true;
        for (const col of allColumns) {
          const val = parseFloat(raw[col]);
          if (!Number.isFinite(val)) {
            ok = false;
            break;
          }
          row[col] = val;
        }
        if (ok) typedRows.push(row);
      }

      if (typedRows.length < 10) {
        logs.push(`❌ Not enough clean rows after numeric parsing. Found only ${typedRows.length}.`);
        console.warn(logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }
      logs.push(`Transformed data into ${typedRows.length} clean rows.`);

      const hasGndr = allColumns.includes('gndr');
      const hasAgea = allColumns.includes('agea');
      const engineeredFeatures = new Set<string>();

      if (hasAgea) {
        const meanAge = typedRows.reduce((sum, r) => sum + (r.agea || 0), 0) / typedRows.length;
        logs.push(`Engineering feature: "agec" from "agea". Calculated mean age: ${meanAge.toFixed(2)}`);
        for (const r of typedRows) r.agec = r.agea - meanAge;
        engineeredFeatures.add('agec');
      }
      if (hasGndr) {
         logs.push('Engineering feature: "female" from "gndr".');
         for (const r of typedRows) r.female = r.gndr === 2 ? 1 : 0;
         engineeredFeatures.add('female');
      }
      
      const finalFeatures = input.features.map(f => {
          if (f === 'gndr') return 'female';
          if (f === 'agea') return 'agec';
          return f;
      });

      const X = typedRows.map(r => finalFeatures.map(f => r[f]));
      const y = typedRows.map(r => r[input.target]);
      
      logs.push(`Step 3 Complete: Data prepared for regression with ${X.length} samples. Features: [${finalFeatures.join(', ')}]`);

      // 4. Perform regression analysis
      logs.push(`Step 4: Performing ${input.analysisType} analysis in Node.js...`);
      let analysisResult;

      if (input.analysisType === 'randomForestRegression') {
        const model = new RandomForestRegression({ nEstimators: 10 });
        model.train(X, y);
        analysisResult = {
            model: "Random Forest Regression",
            message: "Model trained successfully. Feature importance not yet implemented.",
            n: X.length
        };
        logs.push('Random Forest model trained.');
      } else { // Default to linear regression
        const regression = new MultivariateLinearRegression(X, y.map(val => [val]));
        const coefficients = regression.weights.slice(0, -1).flat();
        const intercept = regression.weights[regression.weights.length-1][0];
  
        analysisResult = {
          model: "Linear Regression",
          coefficients: finalFeatures.reduce((obj, feature, i) => {
              obj[feature] = coefficients[i];
              return obj;
          }, {} as Record<string, number>),
          intercept: intercept,
          n: X.length,
        };
        logs.push('Linear Regression complete. Coefficients calculated.');
      }
      
      logs.push('Step 4 Complete: Regression analysis finished successfully.');
      return { result: analysisResult, sqlQuery };

    } catch (e: any) {
      logs.push(`💥 Unexpected error in statisticsTool: ${e.message || 'Unknown error'}`);
      console.error('[statisticsTool]', e);
      return { error: logs.join('\n'), sqlQuery };
    }
  }
);

    