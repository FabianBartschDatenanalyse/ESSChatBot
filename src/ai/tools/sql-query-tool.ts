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

// We will return a stringified JSON so the LLM can easily display it.
const toolOutputSchema = z.string(); 

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
    const debugLog: Record<string, any> = {};
    debugLog.toolCalledWith = input.nlQuestion;
    
    let sqlQuery = '';

    try {
      const codebook = getCodebookAsString();
      
      debugLog.suggestionRequest = 'Requesting SQL query suggestion...';
      const suggestion = await suggestSqlQuery({
        question: input.nlQuestion,
        codebook,
      });
      
      sqlQuery = suggestion.sqlQuery;
      debugLog.suggestionResponse = `Received SQL query suggestion: ${sqlQuery}`;

      if (!sqlQuery || sqlQuery.trim() === '') {
        debugLog.error = 'AI model returned an empty SQL query.';
        return JSON.stringify(debugLog);
      }
      
      debugLog.executionRequest = 'Executing SQL query...';
      const result = await executeQuery(sqlQuery);
      debugLog.executionResponse = result;

      if (result.error) {
        debugLog.finalStatus = `Query execution failed: ${result.error}`;
      } else if (result.results && result.results.length > 0 && result.results[0].rows.length > 0) {
        debugLog.finalStatus = `Success: Returning data with ${result.results[0].rows.length} rows.`;
      } else {
        debugLog.finalStatus = 'Success (no data): Query executed successfully, but returned no data.';
      }

    } catch (e: any) {
      debugLog.error = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
    }
    
    return JSON.stringify(debugLog, null, 2);
  }
);
