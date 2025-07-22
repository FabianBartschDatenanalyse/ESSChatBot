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
import { codebookRetrievalTool } from '../tools/codebook-retrieval-tool';

const MainAssistantInputSchema = z.object({
  question: z.string().describe("The user's question."),
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
Your goal is to answer the user's question as accurately and helpfully as possible by querying the ESS database.

You have access to two tools: \`codebookRetrievalTool\` and \`executeQueryTool\`.

Here is your workflow:
1.  Analyze the user's question: "${input.question}"
2.  First, ALWAYS use the \`codebookRetrievalTool\` to find the most relevant context from the database codebook. Pass the user's question to the 'query' parameter.
3.  Next, use the context from the retrieval tool to decide your next step. If the user's question can be answered by querying the database, use the \`executeQueryTool\`. Pass the original user question to the 'nlQuestion' parameter.
4.  When you get a result from a tool, analyze it:
    - If the tool returns data, explain the data to the user in a clear, easy-to-understand way.
    - If the tool returns an error, inform the user clearly.
    - In all cases where a tool was used, you MUST also present the final SQL query that was used in a markdown code block.

Always strive to provide a comprehensive and easy-to-understand response.`;

    const llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      prompt: initialPrompt,
      tools: [executeQueryTool, codebookRetrievalTool],
    });
    
    const textContent = llmResponse.text;
    
    if (textContent) {
      return { answer: textContent };
    }

    throw new Error("The model did not return a valid response.");
  }
);
