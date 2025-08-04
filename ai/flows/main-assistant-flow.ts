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
import { Message } from 'genkit';

const MainAssistantInputSchema = z.object({
  nlQuestion: z.string().describe("The user's current question."),
  history: z.array(Message).optional().describe("The conversation history."),
});
export type MainAssistantInput = z.infer<typeof MainAssistantInputSchema>;

const MainAssistantOutputSchema = z.object({
  answer: z.string().describe('The final answer to be displayed to the user.'),
  sqlQuery: z.string().optional().describe('The SQL query that was executed.'),
  retrievedContext: z.string().optional().describe('The context retrieved from the vector database.'),
});
export type MainAssistantOutput = z.infer<typeof MainAssistantOutputSchema>;

export async function mainAssistant(input: MainAssistantInput): Promise<MainAssistantOutput> {
    const toolOutput = await executeQueryTool({ nlQuestion: input.nlQuestion, history: input.history });

    const finalPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
    You have just executed a query to answer the user's question.

    User's original question: "${input.nlQuestion}"
    
    Here is the result from the database tool:
    ${JSON.stringify(toolOutput, null, 2)}

    Now, formulate a final, user-friendly answer based on the tool's output.
    - If the tool returned data, analyze and explain it clearly. Present tables in markdown format.
    - If the tool returned an error, state the error message clearly to the user.
    - Your entire response should be just the natural language answer.`;
    
    const finalLlmResponse = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: finalPrompt,
    });

    const answer = finalLlmResponse.text;
  
    return {
      answer,
      sqlQuery: toolOutput.sqlQuery,
      retrievedContext: toolOutput.retrievedContext
    };                  
}
