'use server';
/**
 * @fileOverview A Genkit tool for generating and executing SQL queries.
 *
 * This file defines the `executeQueryTool`, which allows an AI agent to
 * query a database. The tool takes a natural language query, converts
 * it to SQL, executes it, and returns the result along with debug logs.
 */
import { ai } from '@/ai/genkit';
import { executeQuery } from '@/lib/data-service';
import { z } from 'zod';
import { suggestSqlQuery } from '../flows/suggest-sql-query';
import { getCodebookAsString } from '@/lib/codebook';

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language query as input.',
    inputSchema: z.object({
      nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    }),
    outputSchema: z.string().describe('A JSON string containing the query result and debug logs. The result is either data in JSON format or an error message.'),
  },
  async (input) => {
    const logs: string[] = [];
    logs.push(`[executeQueryTool] Tool called with natural language question: "${input.nlQuestion}"`);
    
    try {
      const codebook = getCodebookAsString();
      
      logs.push('[executeQueryTool] Requesting SQL query suggestion...');
      const suggestion = await suggestSqlQuery({
        question: input.nlQuestion,
        codebook,
      });
      logs.push(`[executeQueryTool] Received suggestion object: ${JSON.stringify(suggestion)}`);

      const sqlQuery = suggestion.sqlQuery;

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'Failed to generate a valid SQL query.';
        logs.push('[executeQueryTool] ' + errorMsg);
        return JSON.stringify({ error: errorMsg, logs: logs.join('\n') });
      }
      logs.push(`[executeQueryTool] Extracted SQL query: "${sqlQuery}"`);

      logs.push('[executeQueryTool] Executing SQL query...');
      const result = await executeQuery(sqlQuery);
      logs.push(`[executeQueryTool] Received result from database: ${JSON.stringify(result)}`);

      if (result.error) {
        const errorMsg = `Error executing query: ${result.error}`;
        logs.push('[executeQueryTool] ' + errorMsg);
        return JSON.stringify({ error: errorMsg, logs: logs.join('\n') });
      }

      if (result.results && result.results.length > 0) {
        const jsonResult = JSON.stringify(result.results[0].rows);
        logs.push(`[executeQueryTool] Returning JSON data: ${jsonResult}`);
        return JSON.stringify({ data: jsonResult, logs: logs.join('\n') });
      }
      
      const successMsg = "Query executed successfully, but returned no data.";
      logs.push('[executeQueryTool] ' + successMsg);
      return JSON.stringify({ data: successMsg, logs: logs.join('\n') });

    } catch (e: any) {
      const errorMsg = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
      logs.push('[executeQueryTool] ' + errorMsg);
      console.error(errorMsg, e);
      return JSON.stringify({ error: errorMsg, logs: logs.join('\n') });
    }
  }
);
