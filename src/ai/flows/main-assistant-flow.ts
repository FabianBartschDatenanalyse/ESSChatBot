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
import { statisticsTool } from '../tools/statistics-tool';

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

const mainAssistantFlow = ai.defineFlow(
  {
    name: 'mainAssistantFlow',
    inputSchema: MainAssistantInputSchema,
    outputSchema: MainAssistantOutputSchema,
  },
  async (input) => {
    console.log('[mainAssistantFlow] Received input:', JSON.stringify(input, null, 2));

    const llmResponse = await ai.generate({
        model: 'openai/gpt-4o',
        tools: [executeQueryTool, statisticsTool],
        prompt: `You are an expert data analyst and assistant for the European Social Survey (ESS).
Your goal is to answer the user's question as accurately and helpfully as possible.

You have access to two types of tools:
1.  \`executeQueryTool\`: Use this for questions that require fetching, counting, averaging, or directly viewing data. Examples:
    - "Show me the number of participants from Germany."
    - "What is the average age of respondents?"
    - "Compare trust in police between France and Spain."

2.  \`statisticsTool\`: Use this for questions about relationships, influence, or predictions. It can perform statistical tests like linear regression. Examples:
    - "What is the influence of education on income?"
    - "Is there a relationship between age and political trust?"
    - "Perform a regression to see what predicts life satisfaction."

Based on the user's question and the conversation history, decide which tool is most appropriate. If no tool is needed (e.g., for a greeting or general knowledge question), answer directly.

Conversation History:
${(input.history || []).map(h => `${h.role}: ${h.content}`).join('\n')}

User's Latest Question: "${input.question}"

Analyze the user's request and use the best tool for the job. When you get a result from a tool, analyze it and explain it to the user in a clear, easy-to-understand way.
If a tool was used, you MUST also present the final SQL query that was used in a markdown code block.`,
    });
    
    const toolOutputs = llmResponse.toolCalls.map(async (toolCall) => {
        let toolOutput: any;
        if (toolCall.tool === 'executeQueryTool') {
            toolOutput = await executeQueryTool(toolCall.args as any);
        } else if (toolCall.tool === 'statisticsTool') {
            toolOutput = await statisticsTool(toolCall.args as any);
        } else {
            return {
                tool: toolCall.tool,
                callId: toolCall.id,
                output: { error: `Unknown tool: ${toolCall.tool}` },
            };
        }
        return {
            tool: toolCall.tool,
            callId: toolCall.id,
            output: toolOutput,
        };
    });

    if (toolOutputs.length > 0) {
        const finalLlmResponse = await ai.generate({
            model: 'openai/gpt-4o',
            prompt: `The user asked: "${input.question}". You used a tool and got this result: ${JSON.stringify(await Promise.all(toolOutputs), null, 2)}. Now, formulate a final, user-friendly answer based on the tool's output.`,
        });
        return { answer: finalLlmResponse.text };
    }


    const answer = llmResponse.text;
    
    return {
        answer,
    };
  }
);
