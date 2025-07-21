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
  data: z.any().optional(),
  error: z.string().optional(),
});

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language query as input.',
    inputSchema: z.object({
      nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    }),
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery = '';
    console.log('[executeQueryTool] Tool called with natural language question:', input.nlQuestion);

    try {
      const codebook = getCodebookAsString();
      
      let suggestion: SuggestSqlQueryOutput;
      try {
        console.log('[executeQueryTool] Requesting SQL query suggestion...');
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook,
        });
        sqlQuery = suggestion.sqlQuery;
        console.log('[executeQueryTool] Received SQL query suggestion:', sqlQuery);
      } catch (suggestionError: any) {
        const errorMsg = `Failed to get a valid SQL query suggestion from the AI model. Error: ${suggestionError.message || 'Unknown error'}`;
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg };
      }
      
      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'AI model returned an empty SQL query.';
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg, sqlQuery: '' };
      }
      
      console.log('[executeQueryTool] Executing SQL query...');
      const result = await executeQuery(sqlQuery);
      console.log('[executeQueryTool] Received result from data-service:', JSON.stringify(result, null, 2));

      if (result.error) {
        console.error('[executeQueryTool] Query execution failed:', result.error);
        return { error: result.error, sqlQuery };
      }
      
      if (result.results && result.results.length > 0 && result.results[0].rows.length > 0) {
        console.log(`[executeQueryTool] Success: Returning data with ${result.results[0].rows.length} rows.`);
        return { data: result.results[0].rows, sqlQuery };
      }
      
      console.log('[executeQueryTool] Success (no data): Query executed successfully, but returned no data.');
      return { data: [], sqlQuery };

    } catch (e: any) {
      const errorMsg = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error('[executeQueryTool]', errorMsg);
      return { error: errorMsg, sqlQuery };
    }
  }
);
