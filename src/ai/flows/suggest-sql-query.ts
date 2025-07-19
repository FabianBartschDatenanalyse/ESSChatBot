'use server';

/**
 * @fileOverview An AI agent that suggests SQL queries based on a natural language question.
 *
 * - suggestSqlQuery - A function that suggests SQL queries.
 * - SuggestSqlQueryInput - The input type for the suggestSqlQuery function.
 * - SuggestSqlQueryOutput - The return type for the suggestSqlQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSqlQueryInputSchema = z.object({
  question: z.string().describe('The natural language question to generate a SQL query for.'),
  codebook: z.string().describe('The database codebook to use to construct the query.'),
});
export type SuggestSqlQueryInput = z.infer<typeof SuggestSqlQueryInputSchema>;

const SuggestSqlQueryOutputSchema = z.object({
  sqlQuery: z.string().describe('The suggested SQL query based on the question.'),
});
export type SuggestSqlQueryOutput = z.infer<typeof SuggestSqlQueryOutputSchema>;

export async function suggestSqlQuery(input: SuggestSqlQueryInput): Promise<SuggestSqlQueryOutput> {
  return suggestSqlQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSqlQueryPrompt',
  input: {schema: SuggestSqlQueryInputSchema},
  output: {schema: SuggestSqlQueryOutputSchema},
  prompt: `You are an expert SQL query generator. You will be given a natural language question and a database codebook.

  You will generate a SQL query that answers the question using the codebook. Use only the tables and columns described in the codebook.

  Question: {{{question}}}
  Codebook: {{{codebook}}}

  SQL Query: `,
});

const suggestSqlQueryFlow = ai.defineFlow(
  {
    name: 'suggestSqlQueryFlow',
    inputSchema: SuggestSqlQueryInputSchema,
    outputSchema: SuggestSqlQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
