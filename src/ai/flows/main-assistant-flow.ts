'use server';
/**
 * @fileOverview The main AI assistant agent.
 *
 * This file defines the primary agent for the application. It uses a RAG approach by first using the
 * codebook retrieval tool to find relevant context before deciding whether to use other
 * tools (like querying the database) or answer from its general knowledge.
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
Your goal is to answer the user's question as accurately and helpfully as possible.

You have access to two tools:
1.  \`codebookRetrievalTool\`: Use this to search the ESS codebook for variable names, descriptions, and value labels. This should almost always be your first step to understand the context of the user's question.
2.  \`executeQueryTool\`: Use this to run a SQL query against the ESS database. You should use this tool AFTER you have retrieved context from the codebook tool.

Here is your workflow:
1.  Analyze the user's question: "${input.question}"
2.  Use the \`codebookRetrievalTool\` with a search query derived from the user's question to find relevant context, variable names, and value meanings from the codebook.
3.  Based on the user's question AND the context you retrieved:
    a. If the question can be answered by querying the data (e.g., "what is the average...", "show me data for...", "compare countries..."), formulate a SQL query and execute it with the \`executeQueryTool\`.
    b. If the question is about the codebook, survey methodology, or a general question, answer it directly using the context you retrieved.
4.  When you get a result from a tool, analyze it:
    - If \`executeQueryTool\` returns data, explain the data to the user and present the SQL query you used in a markdown code block.
    - If \`executeQueryTool\` returns an error or no data, inform the user clearly and display the SQL query.
    - If \`codebookRetrievalTool\` returns information, use that information to formulate your answer or your SQL query.

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
