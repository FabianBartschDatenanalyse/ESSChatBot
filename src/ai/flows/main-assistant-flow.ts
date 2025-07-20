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
    
    const initialPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
      Your goal is to answer the user's question as accurately as possible.
      You have access to a tool that can query the ESS database directly.
      
      Here is the database codebook to help you understand the available data:
      --- CODEBOOK START ---
      ${input.codebook}
      --- CODEBOOK END ---

      User's question: "${input.question}"

      First, analyze the user's question.
      - If the question can be answered by querying the data (e.g., "what is the average...", "show me data for...", "compare countries..."), you MUST use the executeQueryTool. Formulate a precise SQL query to get the necessary data by providing a natural language question to the tool.
      - If the question is about the codebook itself, the survey's methodology, or a general question, answer it directly without using the tool.
      
      After using the tool, analyze the data returned and formulate a comprehensive, easy-to-understand answer for the user.
      If you receive an error from the tool, explain the error to the user in a helpful way.
      Always present the final answer in a clear and conversational tone.`;

    // Initial call to the model
    let llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: initialPrompt,
      tools: [executeQueryTool],
    });

    // Check if the model wants to use a tool
    const toolRequest = llmResponse.toolRequest;
    if (toolRequest) {
      // Execute the requested tool
      const toolResult = await executeQueryTool.fn(toolRequest.input);

      // Send the tool's result back to the model to get the final answer
      llmResponse = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: [
          { text: initialPrompt },
          { toolRequest: toolRequest },
          { toolResponse: { name: executeQueryTool.name, output: toolResult } }
        ],
        tools: [executeQueryTool], // Provide tools again in case it needs to re-run
      });
    }

    const output = llmResponse.output;
    const textContent = llmResponse.text;
    
    // If we have a structured output that matches the schema, return it.
    if (output) {
        const parsedOutput = MainAssistantOutputSchema.safeParse(output);
        if (parsedOutput.success) {
          return parsedOutput.data;
        }
    }

    // If there's no structured output but there is text content, use that.
    if (textContent) {
        return { answer: textContent };
    }

    // If we have neither, then the model truly didn't respond.
    throw new Error("The model did not return a valid response.");
  }
);
