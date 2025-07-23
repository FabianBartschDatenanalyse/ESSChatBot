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
import { z } from 'genkit';
import { suggestSqlQuery, type SuggestSqlQueryOutput } from '../flows/suggest-sql-query';
import { searchCodebook } from '@/lib/vector-search';

const toolInputSchema = z.object({
    nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
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
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language question as input.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery = '';
    let retrievedContext = '';
    console.log('[executeQueryTool] Received input:', JSON.stringify(input, null, 2));
    
    try {
      // Step 1: Retrieve relevant context from the vector database.
      const searchResults = await searchCodebook(input.nlQuestion, 5);
      retrievedContext = searchResults
          .map(result => `- ${result.content}`)
          .join('\n');
        
      console.log(`[executeQueryTool] Retrieved context from vector DB:`, retrievedContext);

      // Step 2: Generate SQL using the provided question and retrieved context
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook: retrievedContext,
        });
        sqlQuery = suggestion.sqlQuery;
      } catch (suggestionError: any) {
        const errorMsg = `❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`;
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg, retrievedContext };
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = '❌ AI model returned an empty SQL query.';
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg, sqlQuery, retrievedContext };
      }
      
      console.log(`[executeQueryTool] Generated SQL: ${sqlQuery}`);

      // Step 3: Execute SQL
      const result = await executeQuery(sqlQuery);
      
      if (result.error) {
        console.error('[executeQueryTool] Query execution failed:', result.error);
        return { error: `❌ Query execution failed: ${result.error}`, sqlQuery, retrievedContext };
      }

      if (result.data) {
         if (result.data.length > 0) {
            console.log(`[executeQueryTool] Query returned ${result.data.length} rows.`);
            return { data: result.data, sqlQuery, retrievedContext };
         } else {
            console.warn('[executeQueryTool] SQL executed successfully, but no data was returned.');
            return { data: [], sqlQuery, retrievedContext };
         }
      }
      
      return { error: 'No data or error returned from executeQuery', sqlQuery, retrievedContext };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error('[executeQueryTool]', errorMsg);
      return { error: errorMsg, sqlQuery, retrievedContext };
    }
  }
);
