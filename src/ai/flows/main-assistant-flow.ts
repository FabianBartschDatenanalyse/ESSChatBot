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
import {Message, z} from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';

const MessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
});

const MainAssistantInputSchema = z.object({
  question: z.string().describe("The user's current question."),
  history: z.array(MessageSchema).optional().describe("The conversation history."),
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
    
    const systemPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
Your goal is to answer the user's question as accurately as possible by querying the ESS database.
You have access to one tool: \`executeQueryTool\`.

Here is your workflow based on the user's LATEST question:
1.  Analyze the user's question.
2.  You MUST use the \`executeQueryTool\` to answer the question if it requires data. Pass the user's question directly to the 'nlQuestion' parameter of the tool.
3.  When you get a result from the tool, analyze it:
    - If the tool returns data, explain the data to the user in a clear, easy-to-understand way.
    - If the tool returns an error, you MUST display the error message to the user.
    
Your final answer should be ONLY the natural language response. Do not include the SQL query or context in your answer.`;

    const llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      system: systemPrompt,
      prompt: input.question,
      history: input.history || [],
      tools: [executeQueryTool],
    });
    
    const textContent = llmResponse.text;
    let sqlQuery, retrievedContext;

    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      const toolCall = llmResponse.toolCalls[0];
      const toolOutput = toolCall.output as any; // Cast to any to access dynamic properties
      sqlQuery = toolOutput?.sqlQuery;
      retrievedContext = toolOutput?.retrievedContext;
    }
    
    if (textContent) {
      return { answer: textContent, sqlQuery, retrievedContext };
    }

    // Handle cases where the model decides to respond without using a tool
    if (llmResponse.candidates[0]?.message.content.length > 0) {
      const answer = llmResponse.candidates[0].message.content.map(part => part.text).join('');
      return { answer };
    }


    throw new Error("The model did not return a valid response.");
  }
);
