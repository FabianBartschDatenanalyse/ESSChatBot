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

import { unstable_noStore as noStore } from 'next/cache';
import { ai } from '@/src/ai/genkit';
import { z } from 'zod';
import { executeQueryTool } from '@/src/ai/tools/sql-query-tool';
import { searchCodebook } from '@/src/lib/vector-search';
import { statisticsTool } from '@/src/ai/tools/statistics-tool';
import { chartingTool } from '@/src/ai/tools/charting-tool';

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
  vegaLiteSpec: z.any().optional().describe("The Vega-Lite JSON specification for a chart, if one was generated."),
  pngDataUrl: z.string().optional().describe("A data URL of the rendered PNG chart image, if one was generated."),
});
export type MainAssistantOutput = z.infer<typeof MainAssistantOutputSchema>;

export async function mainAssistant(input: MainAssistantInput): Promise<MainAssistantOutput> {
  noStore();
  const result = await mainAssistantFlow(input);
  console.log('[mainAssistant] Returning from mainAssistant:', { ...result, pngDataUrl: result.pngDataUrl ? '[TRUNCATED]' : undefined });
  return result;
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
    noStore();
    console.log('[mainAssistantFlow] Received input:', JSON.stringify(input, null, 2));

    const llmResponse = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: `You are an expert data analyst and assistant for the European Social Survey (ESS).
Your goal is to answer the user's question as accurately as possible.
You have access to tools that can query the database, perform statistical analysis, and generate charts.

Conversation History:
${(input.history || []).map(h => `${h.role}: ${h.content}`).join('\n')}

User's question: "${input.question}"

Based on the user's question, decide which tool to use, if any:
- If the user asks to "show", "plot", "visualize", "chart", or "draw" data, you MUST use the 'chartingTool'.
- If the question implies a statistical relationship (e.g., "effect of", "relationship between", "predict"), you MUST use the 'statisticsTool'.
- For any other data-related questions (e.g., "what is the average...", "count the number of..."), you MUST use the 'executeQueryTool'.
- If the question is a general greeting, a thank you, or can be answered without data, answer it directly without using any tools.`,
        tools: [executeQueryTool, statisticsTool, chartingTool],
    });

    const choice = llmResponse.choices[0];

    // Case 1: The model wants to use the charting tool
    const chartToolRequest = choice.toolRequest?.find(req => req.tool.name === 'chartingTool');
    if (chartToolRequest) {
        console.log('[mainAssistantFlow] Charting tool requested.');
        const chartOutput = await chartingTool(chartToolRequest.input);

        if (chartOutput.error) {
            return { answer: `I tried to create a chart, but encountered an error: ${chartOutput.error}` };
        }
        
        return {
            answer: `Here is the chart you requested for "${input.question}".`,
            pngDataUrl: chartOutput.pngDataUrl,
            vegaLiteSpec: chartOutput.vegaLiteSpec,
        };
    }
    
    // Case 2: The model wants to use the statistics tool
    const statsToolRequest = choice.toolRequest?.find(req => req.tool.name === 'statisticsTool');
    if (statsToolRequest) {
        console.log('[mainAssistantFlow] Statistics tool requested.');
        const searchResults = await searchCodebook(input.question, 7);
        const retrievedContext = searchResults.map((r: any) => `- ${r.content}`).join('\n');
        
        const toolOutput = await statisticsTool({
            ...statsToolRequest.input,
            codebookContext: retrievedContext,
        });

        const finalPrompt = `You are an expert data analyst. The user asked: "${input.question}". A statistical analysis was performed. Explain the result to the user in a clear, easy-to-understand way.
        
        Analysis Result:
        ${JSON.stringify(toolOutput.result || toolOutput.error, null, 2)}`;

        const finalAnswer = await ai.generate({ model: 'openai/gpt-4o', prompt: finalPrompt });

        return {
            answer: finalAnswer.text,
            sqlQuery: toolOutput.sqlQuery,
            retrievedContext: retrievedContext
        };
    }

    // Case 3: The model wants to use the standard query tool
    const queryToolRequest = choice.toolRequest?.find(req => req.tool.name === 'executeQueryTool');
     if (queryToolRequest) {
        console.log('[mainAssistantFlow] Query tool requested.');
        const toolOutput = await executeQueryTool({
            ...queryToolRequest.input,
            history: input.history,
        });
        
        const finalPrompt = `You are an expert data analyst. The user asked: "${input.question}". A query was executed. Formulate a final, user-friendly answer based on the tool's output. If there was an error, state it clearly.
        
        Tool Output:
        ${JSON.stringify(toolOutput, null, 2)}`;
        
        const finalAnswer = await ai.generate({ model: 'openai/gpt-4o', prompt: finalPrompt });

        return {
            answer: finalAnswer.text,
            sqlQuery: toolOutput.sqlQuery,
            retrievedContext: toolOutput.retrievedContext,
        };
    }

    // Case 4: The model provided a direct answer
    if (choice.message.content) {
        console.log('[mainAssistantFlow] Direct answer provided.');
        return { answer: choice.message.content };
    }

    // Fallback
    return { answer: "I'm not sure how to handle that request. Please try rephrasing." };
  }
);
