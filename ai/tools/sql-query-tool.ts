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
import { z, Message } from 'genkit';
import { suggestSqlQuery, type SuggestSqlQueryOutput } from '../flows/suggest-sql-query';
import { searchCodebook } from '@/lib/vector-search';

const toolInputSchema = z.object({
    nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    history: z.array(Message).optional().describe("The conversation history."),
});

const toolOutputSchema = z.object({
  sqlQuery: z.string().optional(),
  retrievedContext: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language question and optional conversation history as input.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery: string = '';
    let retrievedContext: string = '';
    
    try {
      // Step 1: Retrieve relevant context from the vector database.
      const searchResults = await searchCodebook(input.nlQuestion, 5);
      retrievedContext = searchResults
          .map((result) => `- ${result.content}`)
          .join('\n');
        
      // Step 2: Generate SQL
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook: retrievedContext,
          history: input.history,
        });
        sqlQuery = suggestion.sqlQuery;
      } catch (suggestionError: any) {
        const errorMsg = `❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`;
        return { error: errorMsg, sqlQuery, retrievedContext };
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'AI model returned an empty SQL query.';
        return { error: errorMsg, sqlQuery, retrievedContext };
      }
      
      // Step 3: Execute SQL
      const result = await executeQuery(sqlQuery);
      
      if (result.error) {
        return { error: `❌ Query execution failed: ${result.error}`, sqlQuery, retrievedContext };
      }

      if (result.data) {
         if (result.data.length > 0) {
            return { data: result.data, sqlQuery, retrievedContext };
         } else {
            return { data: [], sqlQuery, retrievedContext };
         }
      }
      
      return { error: 'No data or error returned from executeQuery', sqlQuery, retrievedContext };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`;
      return { error: errorMsg, sqlQuery, retrievedContext };
    }
  }
);
