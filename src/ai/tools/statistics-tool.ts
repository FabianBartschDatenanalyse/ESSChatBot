'use server';

/**
 * @fileOverview A Genkit tool for performing statistical analyses.
 *
 * This file defines the `statisticsTool`, which allows an AI agent to
 * request statistical calculations like linear regression.
 */

import { ai } from '@/ai/genkit';
import { runLinearRegression } from '@/lib/stats-service';
import { z } from 'zod';

const toolInputSchema = z.object({
  target: z.string().describe('The target (dependent) variable for the analysis. This must be a single column name.'),
  features: z.array(z.string()).describe('A list of one or more feature (independent) variables for the analysis. These must be column names.'),
  filters: z.record(z.string(), z.any()).optional().describe('An object of key-value pairs to filter the dataset before analysis. E.g., { "cntry": "DE" }'),
});

const toolOutputSchema = z.object({
  result: z.any().optional(),
  error: z.string().optional(),
  sqlQuery: z.string().optional().describe("The SQL query used to fetch the data for analysis.")
});

export const statisticsTool = ai.defineTool(
  {
    name: 'statisticsTool',
    description: 'Use this tool to perform multiple linear regression analysis on the dataset to understand relationships between variables. Provide a target variable, one or more feature variables, and optional filters.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    console.log('[statisticsTool] Received input:', JSON.stringify(input, null, 2));
    
    try {
        const result = await runLinearRegression(input.target, input.features, input.filters);
        
        if (result.error) {
            console.error('[statisticsTool] Analysis failed:', result.error);
            return { error: `❌ Analysis failed: ${result.error}`, sqlQuery: result.sqlQuery };
        }

        console.log(`[statisticsTool] Analysis successful.`);
        return { result: result.data, sqlQuery: result.sqlQuery };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in statisticsTool: ${e.message || 'Unknown error'}`;
      console.error('[statisticsTool]', errorMsg);
      return { error: errorMsg };
    }
  }
);
