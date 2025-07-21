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
      
      let suggestion: SuggestSqlQueryOutput;
      try {
        suggestion = await suggestSqlQuery({
          question: input.nlQuestion,
          codebook,
        });
      } catch (suggestionError: any) {
        const errorMsg = `Failed to get a valid SQL query suggestion from the AI model. Error: ${suggestionError.message || 'Unknown error'}`;
        return { error: errorMsg };
      }

      sqlQuery = suggestion.sqlQuery;

      if (!sqlQuery || sqlQuery.trim() === '') {
        const errorMsg = 'AI model returned an empty SQL query.';
        return { error: errorMsg, sqlQuery: '' };
      }
      
      const result = await executeQuery(sqlQuery);

      if (result.error) {
        return { error: result.error, sqlQuery };
      }
      
      if (result.results && result.results.length > 0 && result.results[0].rows.length > 0) {
        return { data: result.results[0].rows, sqlQuery };
      }
      
      return { data: [], sqlQuery };

    } catch (e: any) {
      const errorMsg = `An unexpected error occurred in executeQueryTool: ${e.message || 'Unknown error'}`;
      return { error: errorMsg, sqlQuery };
    }
  }
);
