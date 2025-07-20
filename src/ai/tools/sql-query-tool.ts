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
import { suggestSqlQuery } from '../flows/suggest-sql-query';
import { getCodebookAsString } from '@/lib/codebook';

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language query as input.',
    inputSchema: z.object({
      nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    }),
    outputSchema: z.string().describe('A JSON string containing the query result. The result is either data in JSON format or an error message.'),
  },
  async (input) => {
    try {
      const codebook = getCodebookAsString();
      
      const suggestion = await suggestSqlQuery({
        question: input.nlQuestion,
        codebook,
      });

      const sqlQuery = suggestion.sqlQuery;

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'Failed to generate a valid SQL query.';
        return JSON.stringify({ error: errorMsg });
      }

      const result = await executeQuery(sqlQuery);

      if (result.error) {
        const errorMsg = `Error executing query: ${result.error}`;
        return JSON.stringify({ error: errorMsg });
      }

      if (result.results && result.results.length > 0) {
        const jsonResult = JSON.stringify(result.results[0].rows);
        return JSON.stringify({ data: jsonResult });
      }
      
      const successMsg = "Query executed successfully, but returned no data.";
      return JSON.stringify({ data: successMsg });

    } catch (e: any) {
      const errorMsg = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error(errorMsg, e);
      return JSON.stringify({ error: errorMsg });
    }
  }
);
