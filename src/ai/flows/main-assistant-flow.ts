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
import {Message as GenkitMessage, z} from 'zod';
import { executeQueryTool } from '../tools/sql-query-tool';
import { statisticsTool } from '../tools/statistics-tool';
import { MessageSchema } from '@/lib/types';
import { searchCodebook } from '@/lib/vector-search';

// Omit context fields from the history schema to prevent token overflow.
const HistoryMessageSchema = MessageSchema.omit({ sqlQuery: true, retrievedContext: true });

const MainAssistantInputSchema = z.object({
  question: z.string().describe("The user's current question."),
  history: z.array(HistoryMessageSchema).optional().describe("The conversation history."),
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

    // Step 1: Retrieve relevant context from the vector database.
    const searchResults = await searchCodebook(input.question, 10);
    const retrievedContext = searchResults
        .map(result => `- ${result.content}`)
        .join('\n');
      
    console.log(`[mainAssistantFlow] Retrieved context from vector DB:`, retrievedContext);
    
    // Convert Zod-validated history to Genkit's Message type, mapping 'assistant' to 'model'
    const history: GenkitMessage[] = (input.history || []).map(h => ({
      role: h.role === 'assistant' ? 'model' : h.role,
      content: [{ text: h.content }],
    }));

    const systemPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
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

Based on the user's question, the conversation history, and the provided context, decide which tool is most appropriate. If no tool is needed (e.g., for a greeting or general knowledge question), answer directly.

When you get a result from a tool, analyze it and explain it to the user in a clear, easy-to-understand way.
If a tool was used, you MUST also present the final SQL query that was used in a markdown code block.

**Relevant Codebook Context:**
\`\`\`
${retrievedContext}
\`\`\`
`;

    const llmResponse = await ai.generate({
      model: 'openai/gpt-4o',
      tools: [executeQueryTool, statisticsTool],
      system: systemPrompt,
      messages: [...history, { role: 'user', content: [{ text: input.question }] }],
      config: {
        maxToolRoundtrips: 5, // Prevent infinite loops
      },
    });

    const answer = llmResponse.text;
    let sqlQuery: string | undefined;
    
    if (llmResponse.history) {
        const toolCallOutputs = llmResponse.history.filter(m => m.role === 'tool');
        if (toolCallOutputs.length > 0) {
            const lastToolOutput = toolCallOutputs[toolCallOutputs.length - 1];
            try {
                const toolContent = lastToolOutput.content[0].text;
                if (toolContent) {
                    const parsedContent = JSON.parse(toolContent);
                    sqlQuery = parsedContent.sqlQuery;
                }
            } catch (e) {
                console.warn("[mainAssistantFlow] Could not parse tool output to extract context.", e);
            }
        }
    }

    return {
      answer,
      sqlQuery,
      retrievedContext: retrievedContext || undefined, // Always return the context we fetched
    };
  }
);
