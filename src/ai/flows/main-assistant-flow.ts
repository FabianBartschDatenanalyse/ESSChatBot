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
  noStore();
  const result = await mainAssistantFlow(input);
  console.log('[mainAssistant] Returning from mainAssistant:', JSON.stringify(result, null, 2));
  return result;
}

// Define a schema for the question reformulation
const ReformulatedQuestionSchema = z.object({
  reformulatedQuestion: z.string().describe("The reformulated, self-contained question for the tool."),
  requiresTool: z.boolean().describe("Whether the question requires using the database tool."),
});

// Schlankes Schema zur Extraktion eines Regressions-Plans (ohne Variablen-Einschränkung)
const StatsExtractionSchema = z.object({
  needsRegression: z.boolean().describe("True if the question asks for regression/effects/prediction/coefficients."),
  analysisType: z.enum(['linearRegression', 'randomForestRegression']).optional(),
  target: z.string().optional(),
  features: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.any()).optional(),
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
      output: { schema: ReformulatedQuestionSchema },
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

    // Step 2: Unabhängig von SQL zuerst Codebook-Kontext holen
    const searchResults = await searchCodebook(reformulatedQuestion, 7);
    const retrievedContext = searchResults.map((r: any) => `- ${r.content}`).join('\n');
    console.log('[mainAssistantFlow] Retrieved context length:', retrievedContext.length);

    // Step 3: Prüfen, ob Regression gewünscht ist (nur mit Kontext arbeiten)
    const statsPrompt = `Plan a statistical regression only if the question requests regression/effects/prediction/coefficients.

STRICT RULES:
- Use variable names EXACTLY as they appear in the CODEBOOK CONTEXT below.
- Do NOT invent, rename, or reformat variable names.
- If you cannot find required variables in the context, set needsRegression=false and (optionally) include a reason.

Return JSON with keys: needsRegression, analysisType, target, features, filters.

QUESTION:
"${reformulatedQuestion}"

CODEBOOK CONTEXT (authoritative variable names):
${retrievedContext}`;

    let statsOutput: any | null = null;
    try {
      const statsExtraction = await ai.generate({
        model: 'openai/gpt-4o',
        prompt: statsPrompt,
        output: { schema: StatsExtractionSchema },
      });
      const plan = statsExtraction.output!;
      console.log('[mainAssistantFlow] Stats extraction:', JSON.stringify(plan, null, 2));

      // Wenn Regression nötig → direkt statisticsTool ausführen (statisticsTool lädt selbst die Daten via SQL)
      if (plan?.needsRegression) {
        statsOutput = await statisticsTool({
          analysisType: (plan.analysisType ?? 'linearRegression') as 'linearRegression' | 'randomForestRegression',
          target: String(plan.target || '').trim(),
          features: Array.isArray(plan.features) ? plan.features : [],
          filters: plan.filters,
          codebookContext: retrievedContext,
        } as any);
        console.log('[mainAssistantFlow] statisticsTool output:', JSON.stringify(statsOutput, null, 2));

        const finalPrompt = `You are an expert data analyst and assistant for the ESS.
User's original question: "${input.question}"
Reformulated question: "${reformulatedQuestion}"

Regression result:
${JSON.stringify(statsOutput, null, 2)}

Write a clear, user-friendly answer based on the regression result. If there was an error, explain it and suggest next steps.`;

        const finalLlmResponse = await ai.generate({ model: 'openai/gpt-4o', prompt: finalPrompt });
        const answer = finalLlmResponse.text;

        return {
          answer,
          sqlQuery: String(statsOutput?.sqlQuery || ''), // SQL aus statisticsTool, falls vorhanden
          retrievedContext,
        };
      }
    } catch (e) {
      console.warn('[mainAssistantFlow] Regression planning or run failed; falling back to SQL tool:', e);
      // wenn Planung scheitert, normal weiter unten
    }

    // Step 4: Kein Regressionsbedarf → executeQueryTool wie gehabt
    console.log(`[mainAssistantFlow] Tool required. Executing query for: "${reformulatedQuestion}"`);
    const toolOutput = await executeQueryTool({ nlQuestion: reformulatedQuestion, history: input.history });
    console.log('[mainAssistantFlow] Tool output received:', JSON.stringify(toolOutput, null, 2));

    const finalPrompt = `You are an expert data analyst and assistant for the European Social Survey (ESS).
You have just executed a query to answer the user's question.

User's original question: "${input.question}"
The reformulated question used for the query: "${reformulatedQuestion}"

Here is the result from the database tool:
${JSON.stringify(toolOutput, null, 2)}

Now, formulate a final, user-friendly answer based on the tool's output. If there was an error, state it clearly and suggest next steps.`;

    const finalLlmResponse = await ai.generate({ model: 'openai/gpt-4o', prompt: finalPrompt });
    const answer = finalLlmResponse.text;

    return {
      answer,
      sqlQuery: String(toolOutput.sqlQuery || ''),
      retrievedContext,
    };
  }
);
