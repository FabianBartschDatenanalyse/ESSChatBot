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

    try {
      const codebook = getCodebookAsString();

      // Step 1: Generate SQL
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook,
        });
        sqlQuery = suggestion.sqlQuery;
      } catch (suggestionError: any) {
        const errorMsg = `❌ Failed to generate SQL query. Error: ${suggestionError.message || 'Unknown error'}`;
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg };
      }

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = '❌ AI model returned an empty SQL query.';
        console.error('[executeQueryTool]', errorMsg);
        return { error: errorMsg, sqlQuery };
      }

      // Step 2: Execute SQL
      const result = await executeQuery(sqlQuery);

      if (result.error) {
        console.error('[executeQueryTool] Query execution failed:', result.error);
        return { error: `❌ Query execution failed: ${result.error}`, sqlQuery };
      }

      const dataset = result.results?.[0];
      if (
        dataset &&
        Array.isArray(dataset.rows) &&
        dataset.rows.length > 0 &&
        Array.isArray(dataset.columns) &&
        dataset.columns.length > 0
      ) {
        return { data: dataset.rows, sqlQuery };
      }

      console.warn('[executeQueryTool] SQL executed successfully, but no usable data returned.');
      return { data: [], sqlQuery };

    } catch (e: any) {
      const errorMsg = `💥 Unexpected error in executeQueryTool: ${e.message || 'Unknown error'}`;
      console.error('[executeQueryTool]', errorMsg);
      return { error: errorMsg, sqlQuery };
    }
  }
);