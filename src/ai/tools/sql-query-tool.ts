'use server';

/**
 * @fileOverview A Genkit tool for generating and executing SQL queries.
 *
 * This file defines the `executeQueryTool`, which allows an AI agent to
 * query a database. The tool takes a natural language query, converts
 * it to SQL, executes it, and returns the result.
 */

import { ai } from '@/ai/genkit';
import { executeQuery } from '@/lib/data-service';
import { z } from 'zod';
import { suggestSqlQuery, type SuggestSqlQueryOutput } from '../flows/suggest-sql-query';
import { getCodebookAsString } from '@/lib/codebook';

const toolOutputSchema = z.object({
  sqlQuery: z.string().optional(),
  retrievedContext: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language question as input.',
    inputSchema: z.object({
      nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    }),
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery = '';
    
    try {
      // Step 1: Retrieve the full codebook content.
      const codebookContext = getCodebookAsString();
        
      console.log(`[executeQueryTool] Loaded full codebook context.`);

      // Step 2: Generate SQL using the provided question and full codebook context
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook: codebookContext,
        });
        sqlQuery = suggestion.sqlQuery;
      } catch (suggestionError: any) {
        const errorMsg = `❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`;
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg };
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = '❌ AI model returned an empty SQL query.';
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg, sqlQuery };
      }
      
      console.log(`[executeQueryTool] Generated SQL: ${sqlQuery}`);

      // Step 3: Execute SQL
      const result = await executeQuery(sqlQuery);
      
      if (result.error) {
        console.error('[executeQueryTool] Query execution failed:', result.error);
        return { error: `❌ Query execution failed: ${result.error}`, sqlQuery };
      }

      if (result.data) {
         if (result.data.length > 0) {
            console.log(`[executeQueryTool] Query returned ${result.data.length} rows.`);
            return { data: result.data, sqlQuery };
         } else {
            console.warn('[executeQueryTool] SQL executed successfully, but no data was returned.');
            return { data: [], sqlQuery };
         }
      }
      
      return { error: 'No data or error returned from executeQuery', sqlQuery };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error('[executeQueryTool]', errorMsg);
      return { error: errorMsg, sqlQuery };
    }
  }
);
