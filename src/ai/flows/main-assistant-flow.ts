'use server';
/**
 * @fileOverview The main AI assistant agent.
 *
 * This file defines the primary agent for the application. It uses a RAG approach by first retrieving
 * relevant context from the vector DB, then deciding whether to use tools (SQL execution or statistics),
 * or answer directly when no tools are needed.
 *
 * - mainAssistant - The primary function that powers the AI assistant.
 * - MainAssistantInput - The input type for the mainAssistant function.
 * - MainAssistantOutput - The return type for the mainAssistant function.
 */

import { ai } from '../genkit';
import type { Message as GenkitMessage } from 'genkit';
import { z } from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';
import { statisticsTool } from '../tools/statistics-tool';

// Temporary fallback until src/lib/vector-search exists.
// This naive implementation returns empty context to keep the flow compiling.
async function searchCodebook(question: string, limit: number): Promise<Array<{ content: string }>> {
  console.warn('[mainAssistantFlow] searchCodebook shim in use. Create src/lib/vector-search.ts and export searchCodebook to replace this stub.');
  return [];
}

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  sqlQuery: z.string().optional(),
  retrievedContext: z.string().optional(),
});

// Omit context fields from the history schema to prevent token overflow.
const HistoryMessageSchema = MessageSchema.omit({ sqlQuery: true, retrievedContext: true });

const MainAssistantInputSchema = z.object({
  question: z.string().describe("The user's current question."),
  history: z.array(HistoryMessageSchema).optional().describe('The conversation history.'),
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
  async (input: MainAssistantInput) => {
    console.log('[mainAssistantFlow] Received input:', JSON.stringify(input, null, 2));

    // Step 1: Retrieve relevant context from the vector database.
    // Note: vector-search lives under src/lib/vector-search.ts (alias '@/lib/vector-search').
    const searchResults = await searchCodebook(input.question, 10);
    const retrievedContext = searchResults.map((r) => `- ${r.content}`).join('\n');
    console.log('[mainAssistantFlow] Retrieved context length:', retrievedContext.length);

    // Convert history to Genkit's Message type, mapping 'assistant' to 'model'
    const history: GenkitMessage[] = (input.history || []).map((h: z.infer<typeof MessageSchema>) => ({
      role: h.role === 'assistant' ? 'model' : h.role,
      content: [{ text: h.content }],
    }));

    const systemPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).

You have access to two tools:
1) executeQueryTool: Use this to fetch, count, average, or otherwise compute numbers from the ESS1 table.
2) statisticsTool: Use this for regression or modeling questions (linear or random forest).

Use the conversation history and the "Relevant Codebook Context" to determine exact column names (e.g., 'cntry', 'trstprl').
When invoking a tool, you must pass the relevant context to its codebookContext parameter if accepted.

CRITICAL RULES:
- After any tool returns, produce a clear, user-friendly answer based on the tool output.
- If a tool returns an 'error', surface the exact error message verbatim in the final answer.
- Do NOT include raw SQL in your natural language. The UI will display SQL in a separate section.

IMPORTANT EXECUTION GUARDRAIL:
If the user asks for numeric aggregations from "ESS1" (averages, counts, sums, by country/group), call executeQueryTool first.

Relevant Codebook Context:
\`\`\`
${retrievedContext}
\`\`\``;

    const llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      tools: [executeQueryTool, statisticsTool],
      system: systemPrompt,
      messages: [...history, { role: 'user', content: [{ text: input.question }] }],
      config: { maxToolRoundtrips: 5 },
    });

    const answer = llmResponse.text;

    // Try to extract the last sqlQuery from tool responses for UI "Show Details"
    const toolMessages = llmResponse.history?.filter((m) => m.role === 'tool') ?? [];
    let sqlQuery: string | undefined;

    for (let i = toolMessages.length - 1; i >= 0 && !sqlQuery; i--) {
      const toolMessage = toolMessages[i];
      if (toolMessage.toolRequest) {
        const toolResponse = llmResponse.history?.find(
          (m) => m.role === 'tool' && m.toolResponse?.ref === toolMessage.toolRequest.ref
        );
        const output = toolResponse?.toolResponse?.output as any;
        if (output && typeof output === 'object' && 'sqlQuery' in output) {
          sqlQuery = output.sqlQuery as string;
          break;
        }
      }
    }

    // Fallbacks for other Genkit response shapes
    if (!sqlQuery) {
      for (let i = toolMessages.length - 1; i >= 0 && !sqlQuery; i--) {
        const parts = toolMessages[i].content ?? [];
        for (let j = parts.length - 1; j >= 0 && !sqlQuery; j--) {
          const part: any = parts[j];
          const fr = part?.functionResponse;
          if (fr?.name === 'executeQueryTool' && fr?.response?.sqlQuery) {
            sqlQuery = fr.response.sqlQuery as string;
            break;
          }
          const tr = part?.toolResponse;
          if (tr?.name === 'executeQueryTool' && tr?.response?.sqlQuery) {
            sqlQuery = tr.response.sqlQuery as string;
            break;
          }
        }
      }
    }

    return {
      answer,
      sqlQuery,
      retrievedContext: retrievedContext || undefined,
    };
  }
);