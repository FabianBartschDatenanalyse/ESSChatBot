'use server';

/**
 * @fileOverview A Genkit tool for performing statistical analyses by calling a Python backend.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { executeQuery } from '@/lib/data-service';

// Schema for the data structure required by the Python regression service
const RegressionRequestSchema = z.object({
  formula: z.string().describe('The regression formula, e.g., "trstprl ~ female + agec".'),
  data: z.record(z.array(z.number())).describe('Column-oriented data for the regression.'),
});

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

    try {
      // 1. Construct the SQL query to fetch raw data
      const allColumns = Array.from(new Set([input.target, ...input.features]));
      sqlQuery = `SELECT ${allColumns.map(c => `${c}`).join(', ')} FROM "ESS1"`;

      const whereClauses: string[] = [];
      if (input.filters) {
        for (const [key, value] of Object.entries(input.filters)) {
          whereClauses.push(`${key} = '${value}'`);
        }
      }
      // Add generic filters to exclude common missing values
      for (const col of allColumns) {
         if (col === 'gndr') {
            whereClauses.push(`gndr IN ('1','2')`);
         } else {
            whereClauses.push(`${col} NOT IN ('7','8','9','55','66','77','88','99','555','777','888','999','9999')`);
         }
      }

      if (whereClauses.length > 0) {
        sqlQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      console.log('[statisticsTool] Constructed SQL Query:', sqlQuery);

      // 2. Fetch data from Supabase
      const { data: queryData, error: queryError } = await executeQuery(sqlQuery);

      if (queryError) {
        return { error: `SQL query failed: ${queryError}`, sqlQuery };
      }
      if (!queryData || queryData.length < 10) { // Check for a minimum number of rows
        return { error: 'Not enough data available for analysis after filtering.', sqlQuery };
      }

      // 3. Transform data for the Python service
      const columnData: Record<string, number[]> = {};
      allColumns.forEach(col => {
        columnData[col] = [];
      });

      queryData.forEach(row => {
        allColumns.forEach(col => {
          const value = parseFloat(row[col]);
          if (Number.isFinite(value)) {
            columnData[col].push(value);
          }
        });
      });
      
      const formula = `${input.target} ~ ${input.features.join(' + ')}`;
      
      const regressionRequest = {
        formula,
        data: columnData,
      };

      // 4. Call the Python regression service
      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000/regress';
      console.log(`[statisticsTool] Calling Python service at ${pythonServiceUrl}`);
      const response = await fetch(pythonServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regressionRequest),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[statisticsTool] Python service call failed with status ${response.status}:`, errorBody);
        return { error: `Analysis service failed: ${errorBody}`, sqlQuery };
      }

      const result = await response.json();
      console.log('[statisticsTool] Analysis successful:', result);
      return { result, sqlQuery };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in statisticsTool: ${e.message || 'Unknown error'}`;
      console.error(errorMsg);
      return { error: errorMsg, sqlQuery };
    }
  }
);