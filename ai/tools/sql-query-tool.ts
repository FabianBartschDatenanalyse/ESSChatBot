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

const toolInputSchema = z.object({
    nlQuestion: z.string().describe('A natural language question that can be answered with a SQL query.'),
    codebookContext: z.string().describe('Relevant context from the database codebook to use to construct the query.'),
});

const toolOutputSchema = z.object({
  sqlQuery: z.string().optional().describe("The SQL query that was executed to get the data."),
  data: z.any().optional().describe("The data returned from the query."),
  error: z.string().optional().describe("An error message if the query failed, possibly containing debug logs."),
});

export const executeQueryTool = ai.defineTool(
  {
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language question and relevant codebook context as input.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
  },
  async (input) => {
    let sqlQuery = '';
    const logs: string[] = ['[executeQueryTool] Received input: ' + JSON.stringify(input, null, 2)];
    
    try {
      // Step 1: Generate SQL using the provided question and retrieved context
      logs.push('Step 1: Generating SQL query...');
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook: input.codebookContext,
        });
        sqlQuery = suggestion.sqlQuery;
        logs.push(`Step 1 Complete: Generated SQL: ${sqlQuery}`);
      } catch (suggestionError: any) {
        logs.push(`❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`);
        console.error('[executeQueryTool]', logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        logs.push('❌ AI model returned an empty SQL query.');
        console.error('[executeQueryTool]', logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }
      
      // Step 2: Execute SQL
      logs.push('Step 2: Executing SQL query...');
      const result = await executeQuery(sqlQuery);
      
      if (result.error) {
        logs.push(`❌ Query execution failed: ${result.error}`);
        console.error('[executeQueryTool]', logs[logs.length-1]);
        return { error: logs.join('\n'), sqlQuery };
      }

      if (result.data) {
         if (result.data.length > 0) {
            logs.push(`Step 2 Complete: Query returned ${result.data.length} rows.`);
            console.log(`[executeQueryTool] Query returned ${result.data.length} rows.`);
            return { data: result.data, sqlQuery };
         } else {
            logs.push('Step 2 Complete: SQL executed successfully, but no data was returned.');
            console.warn('[executeQueryTool]', logs[logs.length-1]);
            return { data: [], sqlQuery };
         }
      }
      
      logs.push('❌ No data or error returned from executeQuery.');
      return { error: logs.join('\n'), sqlQuery };

    } catch (e: any) {
      logs.push(`💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`);
      console.error('[executeQueryTool]', logs[logs.length-1], e);
      return { error: logs.join('\n'), sqlQuery };
    }
  }
);
