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
  codebook: z.string().describe('The full database codebook to use as a reference for available tables and columns.'),
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
  model: 'openai/gpt-4o',
  prompt: `You are an expert SQL query writer. Your task is to generate a valid SQL query based on a user's question and a comprehensive database codebook.

  Carefully analyze the user's question and the provided codebook to construct an accurate query.

  **CRITICAL RULES:**
  1.  **Table Name:** The ONLY table you can query is "ESS1". This table name MUST ALWAYS be enclosed in double quotes (e.g., \`FROM "ESS1"\`).
  2.  **Column Names:** You MUST use the exact column names as they appear in the codebook. Pay close attention to abbreviations (e.g., 'cntry' for country, 'trstprl' for trust in parliament). DO NOT use intuitive but incorrect names like 'country'. Column names should NOT be quoted.
  3.  **Casting:** When performing mathematical operations (like AVG, SUM, etc.) on a column, you MUST cast it to a numeric type (e.g., \`CAST(trstprl AS NUMERIC)\`).
  4.  **No Semicolon:** The generated SQL query MUST NOT end with a semicolon.
  5.  **Filtering Missing Values:** When aggregating data (e.g., with AVG, COUNT), you MUST exclude rows with missing or invalid data. The codebook specifies missing values with codes like 77 (Refusal), 88 (Don't know), and 99 (No answer). Always include a \`WHERE\` clause to filter these out (e.g., \`WHERE trstprl NOT IN (77, 88, 99)\`).

  **User's Question:**
  {{{question}}}

  **Database Codebook:**
  \`\`\`
  {{{codebook}}}
  \`\`\`

  Based on the rules, the question, and the codebook, generate the SQL query.`,
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
