'use server';

/**
 * @fileOverview A Genkit tool for performing statistical analyses using a Node.js library.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { executeQuery } from '@/lib/data-service';
import MultivariateLinearRegression from 'ml-regression-multivariate-linear';

const toolInputSchema = z.object({
  target: z.string().describe('The target (dependent) variable for the analysis. Must be a single column name.'),
  features: z.array(z.string()).describe('A list of one or more feature (independent) variables. Must be column names.'),
  filters: z.record(z.string(), z.any()).optional().describe('Key-value pairs to filter the dataset. E.g., { "cntry": "DE" }.'),
  codebookContext: z.string().describe('Relevant context from the database codebook.'),
});

const toolOutputSchema = z.object({
  result: z.any().optional(),
  error: z.string().optional(),
  sqlQuery: z.string().optional().describe("The SQL query used to fetch the data for analysis.")
});

export const statisticsTool = ai.defineTool(
  {
    name: 'statisticsTool',
    description: 'Use this tool to perform multiple linear regression. Provide a target variable, feature variables, and optional filters.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    console.log('[statisticsTool] Received input:', JSON.stringify(input, null, 2));
    let sqlQuery = '';
    const logs: string[] = ['[statisticsTool] Starting analysis with Node.js regression library.'];

    try {
      // 1. Construct the SQL query to fetch raw data
      const allColumns = Array.from(new Set([input.target, ...input.features]));
      sqlQuery = `SELECT ${allColumns.map(c => `${c}`).join(', ')} FROM "ESS1"`;
      logs.push(`Step 1: Constructed initial SELECT clause: SELECT ${allColumns.join(', ')} FROM "ESS1"`);

      const whereClauses: string[] = [];
      if (input.filters) {
        for (const [key, value] of Object.entries(input.filters)) {
          whereClauses.push(`${key} = '${value}'`);
        }
      }
      logs.push(`Added user-defined filters: ${JSON.stringify(input.filters) || 'None'}`);

      // Add generic filters to exclude common missing values
      for (const col of allColumns) {
         if (col === 'gndr') {
            whereClauses.push(`gndr IN ('1','2')`);
         } else {
            whereClauses.push(`${col} NOT IN ('7', '8', '9', '55', '66', '77', '88', '99', '555', '777', '888', '999', '9999')`);
         }
      }
      logs.push('Added generic filters for missing values.');

      if (whereClauses.length > 0) {
        sqlQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      logs.push(`Step 1 Complete: Final SQL Query: ${sqlQuery}`);
      console.log(logs[logs.length-1]);

      // 2. Fetch data from Supabase
      logs.push('Step 2: Fetching data from Supabase...');
      console.log(logs[logs.length-1]);
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
      console.log(logs[logs.length-1]);
      
      // 3. Transform data for the regression library
      logs.push('Step 3: Transforming data for regression library...');
      console.log(logs[logs.length-1]);
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

      if (hasAgea) {
        const meanAge = typedRows.reduce((sum, r) => sum + (r.agea || 0), 0) / typedRows.length;
        logs.push(`Engineering feature: "agec" from "agea". Calculated mean age: ${meanAge.toFixed(2)}`);
        for (const r of typedRows) r.agec = r.agea - meanAge;
      }
      if (hasGndr) {
         logs.push('Engineering feature: "female" from "gndr".');
         for (const r of typedRows) r.female = r.gndr === 2 ? 1 : 0;
      }
      
      const finalFeatures = input.features.map(f => {
          if (f === 'gndr') return 'female';
          if (f === 'agea') return 'agec';
          return f;
      });

      const X = typedRows.map(r => finalFeatures.map(f => r[f]));
      const y = typedRows.map(r => [r[input.target]]);
      
      logs.push(`Step 3 Complete: Data prepared for regression with ${X.length} samples.`);

      // 4. Perform regression analysis
      logs.push('Step 4: Performing multiple linear regression in Node.js...');
      console.log(logs[logs.length - 1]);
      
      const regression = new MultivariateLinearRegression(X, y);

      // The 'ml-regression' library does not provide all the stats out-of-the-box like statsmodels.
      // We will return the coefficients and intercept which are the primary outputs.
      // The `weights` property contains coefficients and the intercept at the end.
      const coefficients = regression.weights.slice(0, -1).flat();
      const intercept = regression.weights[regression.weights.length-1][0];

      const result = {
        coefficients: finalFeatures.reduce((obj, feature, i) => {
            obj[feature] = coefficients[i];
            return obj;
        }, {} as Record<string, number>),
        intercept: intercept,
        rSquared: regression.score(X,y).r2,
        n: X.length,
      };
      
      logs.push('Step 4 Complete: Regression analysis finished successfully.');
      console.log('[statisticsTool] Analysis successful.');
      return { result, sqlQuery };

    } catch (e: any) {
      logs.push(`💥 Unexpected error in statisticsTool: ${e.message || 'Unknown error'}`);
      console.error('[statisticsTool]', e.stack);
      return { error: logs.join('\n'), sqlQuery };
    }
  }
);
