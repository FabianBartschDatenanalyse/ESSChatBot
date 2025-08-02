'use server';
/**
 * @fileOverview The main AI assistant agent.
 *
 * This file defines the primary agent for the application. It orchestrates responses to user queries
 * by first retrieving relevant context from a vector database and then invoking the appropriate tool
 * (e.g., `executeQueryTool`) to get the final answer.
 *
 * - mainAssistant - The primary function that powers the AI assistant.
 * - MainAssistantInput - The input type for the mainAssistant function.
 * - MainAssistantOutput - The return type for the mainAssistant function.
 */

import { ai } from '../genkit';
import { z } from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';
import { searchCodebook } from '@/lib/vector-search';
import { Message as GenkitMessage } from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
});

const MainAssistantInputSchema = z.object({
  question: z.string().describe("The user's current question."),
  history: z.array(MessageSchema).optional().describe('The conversation history.'),
});
export type MainAssistantInput = z.infer<typeof MainAssistantInputSchema>;

const MainAssistantOutputSchema = z.object({
  answer: z.string().describe('The final answer to be displayed to the user.'),
  sqlQuery: z.string().optional().describe('The SQL query that was executed.'),
  retrievedContext: z.string().optional().describe('The context retrieved from the vector database.'),
});
export type MainAssistantOutput = z.infer<typeof MainAssistantOutputSchema>;

export async function mainAssistant(input: MainAssistantInput): Promise<MainAssistantOutput> {
  return mainAssistantFlow(input);
}

const mainAssistantFlow = ai.defineFlow(
  {
    name: 'mainAssistantFlow',
    inputSchema: MainAssistantInputSchema,
    outputSchema: MainAssistantOutputSchema,
  },
  async (input) => {
    console.log('[mainAssistantFlow] Received input:', JSON.stringify(input, null, 2));

    const history: GenkitMessage[] = (input.history || []).map((h) => ({
        role: h.role === 'assistant' ? 'model' : h.role,
        content: [{ text: h.content }],
    }));

    // Step 1: Retrieve context and call the tool in one go.
    // The tool itself will handle vector search, SQL generation, and execution.
    const toolResponse = await executeQueryTool({
      nlQuestion: input.question, // Corrected from 'question' to 'nlQuestion'
      history: input.history,
    });

    console.log('[mainAssistantFlow] Received response from executeQueryTool:', JSON.stringify(toolResponse, null, 2));

    let finalAnswer: string;
    let sqlQuery: string | undefined = toolResponse.sqlQuery;
    let retrievedContext: string | undefined = toolResponse.retrievedContext;

    if (toolResponse.error) {
      // If the tool returned an error, use it as the answer.
      finalAnswer = toolResponse.error;
    } else if (toolResponse.data) {
      // If the tool returned data, ask the LLM to summarize it for the user.
      const llmResponse = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: `The user asked: "${input.question}". The following data was retrieved from the database using the SQL query: \`${sqlQuery}\`. Please provide a clear, user-friendly summary of this data. Data: ${JSON.stringify(toolResponse.data)}`,
      });
      finalAnswer = llmResponse.text;
    } else {
      // Fallback if the tool returns neither data nor an error.
      finalAnswer = "The tool executed successfully but returned no specific data or error.";
      console.warn('[mainAssistantFlow] Tool returned no data or error.');
    }

    return {
      answer: finalAnswer,
      sqlQuery: sqlQuery,
      retrievedContext: retrievedContext,
    };
  }
);
