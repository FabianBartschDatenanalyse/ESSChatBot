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
import { z } from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';
import { searchCodebook } from '@/lib/vector-search';

const MessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'tool']),
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

// Define a schema for the question reformulation
const ReformulatedQuestionSchema = z.object({
    reformulatedQuestion: z.string().describe("The reformulated, self-contained question for the tool."),
    requiresTool: z.boolean().describe("Whether the question requires using the database tool."),
});

const mainAssistantFlow = ai.defineFlow(
  {
    name: 'mainAssistantFlow',
    inputSchema: MainAssistantInputSchema,
    outputSchema: MainAssistantOutputSchema,
  },
  async (input) => {
    console.log('[mainAssistantFlow] Received input:', JSON.stringify(input, null, 2));

    // Step 1: Decide if a tool is needed and reformulate the question if necessary.
    const reformulationPrompt = `You are an expert at processing conversations. Your task is to determine if the user's latest question requires database access and to reformulate it into a self-contained question if it's a follow-up.

    Conversation History:
    ${(input.history || []).map(h => `${h.role}: ${h.content}`).join('\n')}

    User's Latest Question: "${input.question}"

    Analyze the latest question in the context of the history.
    - If the question is a follow-up (e.g., "what about in percentages?", "and for Germany?"), rephrase it into a complete, standalone question that can be understood without the chat history (e.g., "What is the percentage of people per country who think politics is complicated?").
    - If the question is already self-contained, use it as is.
    - If the question is a general greeting, a thank you, or something that doesn't require the database, set 'requiresTool' to false and keep the question as is.

    Based on this, provide the reformulated question and whether a tool is required.`;

    const reformulationResponse = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: reformulationPrompt,
        output: {
            schema: ReformulatedQuestionSchema,
        },
    });

    const { reformulatedQuestion, requiresTool } = reformulationResponse.output!;
    console.log('[mainAssistantFlow] Reformulation result:', JSON.stringify({ reformulatedQuestion, requiresTool }, null, 2));

    if (!requiresTool) {
        // If no tool is needed, generate a direct answer.
        console.log('[mainAssistantFlow] No tool required. Generating a direct answer.');
        const directAnswerResponse = await ai.generate({
            model: 'openai/gpt-4o',
            prompt: `Answer the following user question: "${reformulatedQuestion}"`,
        });
        return { answer: directAnswerResponse.text };
    }

    // Step 2: Use the reformulated question with the executeQueryTool.
    console.log(`[mainAssistantFlow] Tool required. Executing query for: "${reformulatedQuestion}"`);
    const toolOutput = await executeQueryTool(
        { nlQuestion: reformulatedQuestion, history: input.history }
    );
    
    console.log('[mainAssistantFlow] Tool output received:', JSON.stringify(toolOutput, null, 2));

    const finalPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
    You have just executed a query to answer the user's question.

    User's original question: "${input.question}"
    The reformulated question used for the query: "${reformulatedQuestion}"
    
    Here is the result from the database tool:
    ${JSON.stringify(toolOutput, null, 2)}

    Now, formulate a final, user-friendly answer based on the tool's output.
    - If the tool returned data, analyze and explain it clearly.
    - If the tool returned an error, state the error message clearly to the user.
    - Do include the SQL query or the retrieved context in your final response under Show Details.
    - Your entire response should be just the natural language answer.`;
    
    const finalLlmResponse = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: finalPrompt,
    });

    const answer = finalLlmResponse.text;

    return {
        answer,
        sqlQuery: toolOutput.sqlQuery,
        retrievedContext: toolOutput.retrievedContext,
    };
  }
);