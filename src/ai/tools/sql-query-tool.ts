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
  logs: z.array(z.string()).optional(),
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
    const logs: string[] = [];

    try {
      logs.push(`[executeQueryTool] Tool called with natural language question: "${input.nlQuestion}"`);
      const codebook = getCodebookAsString();
      
      logs.push(`[executeQueryTool] Requesting SQL query suggestion...`);
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook,
        });
        logs.push(`[executeQueryTool] Received suggestion object: ${JSON.stringify(suggestion)}`);
      } catch (suggestionError: any) {
        const errorMsg = `Failed to get a valid SQL query suggestion from the AI model. Error: ${suggestionError.message || 'Unknown error'}`;
        logs.push(`[executeQueryTool] CATCH-BLOCK Error: ${errorMsg}`);
        return { error: errorMsg, logs };
      }

      sqlQuery = suggestion.sqlQuery;
      logs.push(`[executeQueryTool] Extracted SQL query: "${sqlQuery}"`);

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'AI model returned an empty SQL query.';
        logs.push(`[executeQueryTool] Validation Error: ${errorMsg}`);
        return { error: errorMsg, sqlQuery: '', logs };
      }
      
      logs.push(`[executeQueryTool] Executing SQL query...`);
      const result = await executeQuery(sqlQuery);
      logs.push(`[executeQueryTool] Received result from database: ${JSON.stringify(result)}`);

      if (result.error) {
        logs.push(`[executeQueryTool] Error executing query: ${result.error}`);
        return { error: result.error, sqlQuery, logs };
      }
      
      if (result.results && result.results.length > 0 && result.results[0].rows.length > 0) {
        logs.push(`[executeQueryTool] Success: Found ${result.results[0].rows.length} rows.`);
        return { data: result.results[0].rows, sqlQuery, logs };
      }
      
      const successMsg = "Query executed successfully, but returned no data.";
      logs.push(`[executeQueryTool] Success (no data): ${successMsg}`);
      return { data: [], sqlQuery, logs };

    } catch (e: any) {
      const errorMsg = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
       logs.push(`[executeQueryTool] CATCH-BLOCK Error: ${errorMsg}`);
      return { error: errorMsg, sqlQuery, logs };
    }
  }
);
