'use server';
/**
 * @fileOverview The main AI assistant agent.
 *
 * This file defines the primary agent for the application. The agent is responsible for
 * orchestrating responses to user queries. It uses a RAG approach by first searching a
 * vector store of the codebook to find relevant context before deciding whether to use
 * tools (like querying the database) or answer from its general knowledge.
 *
 * - mainAssistant - The primary function that powers the AI assistant.
 * - MainAssistantInput - The input type for the mainAssistant function.
 * - MainAssistantOutput - The return type for the mainAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';
import { searchCodebook } from '@/lib/vector-search';

const MainAssistantInputSchema = z.object({
  question: z.string().describe('The user\'s question.'),
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

    // Step 1: Search the codebook for relevant context using vector search.
    const searchResults = await searchCodebook(input.question, 3);
    const codebookContext = searchResults
        .map(result => `- ${result.content}`)
        .join('\n');
    
    const initialPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
Your goal is to answer the user's question as accurately as possible.
You have access to a tool that can query the ESS database directly.

To help you, here are the MOST RELEVANT sections from the database codebook based on the user's question. Use this context to inform your decision and to construct SQL queries if needed:
--- RELEVANT CODEBOOK CONTEXT ---
${codebookContext || 'No specific context found. Rely on general knowledge of the ESS variables.'}
--- END CODEBOOK CONTEXT ---

User's question: "${input.question}"

First, analyze the user's question and the provided context.
- If the question can be answered by querying the data (e.g., "what is the average...", "show me data for...", "compare countries..."), you MUST use the executeQueryTool. Use the context to find correct variable/column names.
- If the question is about the codebook itself, the survey's methodology, or a general question, answer it directly using the provided context.

When you receive the result from the 'executeQueryTool', you MUST follow these instructions:
- If the result contains a 'data' array with items, analyze the data and formulate a comprehensive, easy-to-understand answer for the user.
- If the result contains an empty 'data' array, inform the user that the query was successful but returned no data.
- If the result contains an 'error' field, you MUST display the error message to the user.
- In all cases where the tool was used, you MUST also display the exact SQL query that was used to retrieve the data. Enclose the query in a markdown code block.`;

    const llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: initialPrompt,
      tools: [executeQueryTool],
    });
    
    const textContent = llmResponse.text;
    
    if (textContent) {
      return { answer: textContent };
    }

    throw new Error("The model did not return a valid response.");
  }
);
