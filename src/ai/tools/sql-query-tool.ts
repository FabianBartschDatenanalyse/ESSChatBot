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

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language query as input.',
    inputSchema: z.object({
      nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    }),
    outputSchema: z.string().describe('A JSON string containing the query result. The result is either data in JSON format or an error message, and may include debugging logs.'),
  },
  async (input) => {
    const logs: string[] = [];
    try {
      logs.push(`[executeQueryTool] Tool called with natural language question: "${input.nlQuestion}"`);
      const codebook = getCodebookAsString();
      
      logs.push('[executeQueryTool] Requesting SQL query suggestion...');
      
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook,
        });
        logs.push(`[executeQueryTool] Received suggestion object: ${JSON.stringify(suggestion)}`);
      } catch (suggestionError: any) {
        const errorMsg = `Failed to get a valid SQL query suggestion from the AI model. Error: ${suggestionError.message || 'Unknown error'}`;
        logs.push(`[executeQueryTool] CATCH-BLOCK (suggestion): ${errorMsg}`);
        return JSON.stringify({ error: errorMsg, logs: logs.join('\n') });
      }


      const sqlQuery = suggestion.sqlQuery;
      logs.push(`[executeQueryTool] Extracted SQL query: "${sqlQuery}"`);


      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'AI model returned an empty SQL query.';
        logs.push(`[executeQueryTool] Error: ${errorMsg}`);
        return JSON.stringify({ error: errorMsg, logs: logs.join('\n') });
      }

      logs.push('[executeQueryTool] Executing SQL query...');
      const result = await executeQuery(sqlQuery);
      logs.push(`[executeQueryTool] Received result from database: ${JSON.stringify(result)}`);


      if (result.error) {
        logs.push(`[executeQueryTool] Error executing query: ${result.error}`);
        return JSON.stringify({ error: result.error, logs: logs.join('\n') });
      }

      if (result.results && result.results.length > 0) {
        return JSON.stringify({ data: result.results[0].rows, logs: logs.join('\n') });
      }
      
      const successMsg = "Query executed successfully, but returned no data.";
      logs.push(`[executeQueryTool] Success: ${successMsg}`);
      return JSON.stringify({ data: successMsg, logs: logs.join('\n') });

    } catch (e: any) {
      const errorMsg = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
      logs.push(`[executeQueryTool] CATCH-BLOCK Error: ${errorMsg}`);
      return JSON.stringify({ error: errorMsg, logs: logs.join('\n') });
    }
  }
);
