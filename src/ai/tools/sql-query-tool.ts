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
    outputSchema: z.string().describe('The result of the query execution, either the data in JSON format or an error message.'),
  },
  async (input) => {
    try {
      const codebook = getCodebookAsString();
      // 1. Suggest a SQL query from the natural language question
      const suggestion = await suggestSqlQuery({
        question: input.nlQuestion,
        codebook,
      });
      const sqlQuery = suggestion.sqlQuery;

      if (!sqlQuery) {
        return 'Failed to generate a SQL query.';
      }

      // 2. Execute the suggested query
      const result = await executeQuery(sqlQuery);
      
      if (result.error) {
        return `Error executing query: ${result.error}`;
      }

      if (result.results && result.results.length > 0) {
        // Return the data as a stringified JSON
        return JSON.stringify(result.results[0].rows);
      }
      
      return "Query executed successfully, but returned no data.";

    } catch (e: any) {
      return `An unexpected error occurred: ${e.message || 'Unknown error'}`;
    }
  }
);
