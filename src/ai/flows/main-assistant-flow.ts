'use server';
/**
 * @fileOverview The main AI assistant agent.
 *
 * This file defines the primary agent for the application. The agent is responsible for
 * orchestrating responses to user queries. It can decide whether to use tools (like querying
 * the database) or answer from its general knowledge based on the user's question.
 *
 * - mainAssistant - The primary function that powers the AI assistant.
 * - MainAssistantInput - The input type for the mainAssistant function.
 * - MainAssistantOutput - The return type for the mainAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';

const MainAssistantInputSchema = z.object({
  question: z.string().describe('The user\'s question.'),
  codebook: z.string().describe('The database codebook for context.'),
});
export type MainAssistantInput = z.infer<typeof MainAssistantInputSchema>;

const MainAssistantOutputSchema = z.object({
  answer: z.string().describe('The final answer to be displayed to the user.'),
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
    const llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: `You are an expert data analyst and assistant for the European Social Survey (ESS).
      Your goal is to answer the user's question as accurately as possible.
      You have access to a tool that can query the ESS database directly.
      
      Here is the database codebook to help you understand the available data:
      --- CODEBOOK START ---
      {{{codebook}}}
      --- CODEBOOK END ---

      User's question: "{{{question}}}"

      First, analyze the user's question.
      - If the question can be answered by querying the data (e.g., "what is the average...", "show me data for...", "compare countries..."), use the executeQueryTool. Formulate a precise SQL query to get the necessary data.
      - If the question is about the codebook itself, the survey's methodology, or a general question, answer it directly without using the tool.
      
      After using the tool, analyze the data returned and formulate a comprehensive, easy-to-understand answer for the user.
      If you receive an error from the tool, explain the error to the user in a helpful way.
      Always present the final answer in a clear and conversational tone.`,
      tools: [executeQueryTool],
      output: {
        schema: MainAssistantOutputSchema
      }
    });

    const output = llmResponse.output;
    if (!output) {
      throw new Error('The model did not return a response.');
    }
    return output;
  }
);
