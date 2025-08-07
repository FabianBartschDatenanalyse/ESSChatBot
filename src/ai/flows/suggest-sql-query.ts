'use server';

/**
 * @fileOverview An AI agent that suggests SQL queries based on a natural language question.
 *
 * - suggestSqlQuery - A function that suggests SQL queries.
 * - SuggestSqlQueryInput - The input type for the suggestSqlQuery function.
 * - SuggestSqlQueryOutput - The return type for the suggestSqlQuery function.
 */

import {ai} from '@/src/ai/genkit';
import {z, Message} from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
});

const SuggestSqlQueryInputSchema = z.object({
  question: z.string().describe('The natural language question to generate a SQL query for.'),
  codebook: z.string().describe('Relevant context from the database codebook to use to construct the query.'),
  history: z.array(MessageSchema).optional().describe("The conversation history."),
});
export type SuggestSqlQueryInput = z.infer<typeof SuggestSqlQueryInputSchema>;

const SuggestSqlQueryOutputSchema = z.object({
  sqlQuery: z.string().describe('The suggested SQL query based on the question. Should be an empty string if no valid query can be generated.'),
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
  prompt: `You are an expert SQL query writer. Your task is to generate a valid SQL query based on a user's question, conversation history, and relevant context from a database codebook.

  Carefully analyze the user's question, the history, and the provided context to construct an accurate query.

  **CRITICAL RULES:**
  1.  **Table Name:** The ONLY table you can query is "ESS1". This table name MUST ALWAYS be enclosed in double quotes (e.g., \`FROM "ESS1"\`).
  2.  **Column Names:** You MUST use the exact column names as they appear in the codebook context. Pay close attention to abbreviations (e.g., 'cntry' for country, 'trstprl' for trust in parliament). DO NOT use intuitive but incorrect names like 'country'. Column names should NOT be quoted.
  3.  **Casting:** When performing mathematical operations (like AVG, SUM, etc.) on a column, you MUST cast it to a numeric type (e.g., \`CAST(trstprl AS NUMERIC)\`).
  4.  **No Semicolon:** The generated SQL query MUST NOT end with a semicolon.
  5.  **Filtering Missing Values:** When aggregating data (e.g., with AVG, COUNT), you MUST exclude rows with missing or invalid data. The codebook specifies missing values with codes like 77, 88, and 99. These are stored as TEXT, so you MUST compare them as strings. Always include a \`WHERE\` clause to filter these out (e.g., \`WHERE trstprl NOT IN ('77', '88', '99')\`).
  6.  **Empty Query Fallback:** If you cannot determine a valid SQL query from the request, you MUST return an empty string for the 'sqlQuery' field.

  **Conversation History (for context on follow-up questions):**
  {{#if history}}
    {{#each history}}
      **{{role}}**: {{content}}
    {{/each}}
  {{else}}
    No history.
  {{/if}}

  **User's Current Question (this is the question you need to turn into SQL):**
  {{{question}}}

  **Relevant Codebook Context:**
  \`\`\`
  {{{codebook}}}
  \`\`\`

  Based on all the above, generate the SQL query and return it in the following JSON format:

{
  "sqlQuery": "your SQL query here"
}

If you cannot generate a query, return:

{
  "sqlQuery": ""
}
`,
});


const suggestSqlQueryFlow = ai.defineFlow(
  {
    name: 'suggestSqlQueryFlow',
    inputSchema: SuggestSqlQueryInputSchema,
    outputSchema: SuggestSqlQueryOutputSchema,
  },
  async input => {
    console.log('[suggestSqlQueryFlow] Received input:', JSON.stringify(input, null, 2));
    const {output} = await prompt(input);


    if (!output?.sqlQuery || typeof output.sqlQuery !== 'string') {
      console.error('[suggestSqlQueryFlow] Invalid output from LLM:', output);
      throw new Error('❌ LLM did not return a valid sqlQuery string.');
    }

    
    console.log('[suggestSqlQueryFlow] LLM output:', JSON.stringify(output, null, 2));
    return output!;
  }
);