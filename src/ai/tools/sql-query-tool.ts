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
    console.log('>>> [executeQueryTool] Tool called with natural language question:', input.nlQuestion);
    try {
      const codebook = getCodebookAsString();
      
      console.log('>>> [executeQueryTool] Requesting SQL query suggestion...');
      const suggestion = await suggestSqlQuery({
        question: input.nlQuestion,
        codebook,
      });
      console.log('>>> [executeQueryTool] Received suggestion object:', suggestion);

      const sqlQuery = suggestion.sqlQuery;

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'Failed to generate a valid SQL query.';
        console.error('>>> [executeQueryTool] ' + errorMsg);
        return errorMsg;
      }
      console.log('>>> [executeQueryTool] Extracted SQL query:', sqlQuery);

      console.log('>>> [executeQueryTool] Executing SQL query...');
      const result = await executeQuery(sqlQuery);
      console.log('>>> [executeQueryTool] Received result from database:', result);

      if (result.error) {
        const errorMsg = `Error executing query: ${result.error}`;
        console.error('>>> [executeQueryTool] ' + errorMsg);
        return errorMsg;
      }

      if (result.results && result.results.length > 0) {
        const jsonResult = JSON.stringify(result.results[0].rows);
        console.log('>>> [executeQueryTool] Returning JSON data:', jsonResult);
        return jsonResult;
      }
      
      const successMsg = "Query executed successfully, but returned no data.";
      console.log('>>> [executeQueryTool] ' + successMsg);
      return successMsg;

    } catch (e: any) {
      const errorMsg = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error('>>> [executeQueryTool] ' + errorMsg, e);
      return errorMsg;
    }
  }
);
