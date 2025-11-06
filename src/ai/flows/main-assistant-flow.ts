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
import { ai, isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { z } from 'zod';
import { executeQueryTool } from '@/src/ai/tools/sql-query-tool';
import { statisticsTool } from '@/src/ai/tools/statistics-tool';
import { generateVisualization } from '@/src/features/charting/server/generate-visualization';
import { VisualizationChartMessageSchema } from '@/src/features/charting/types';
import { StatisticsAnalysisSchema } from '@/src/features/statistics/types';
import { randomUUID } from 'crypto';
import { getDatasetMetadata } from '@/src/features/datasets/server';
import { getDatasetPromptContext } from '@/src/features/datasets/prompt-utils';
import { datasetTableName } from '@/src/features/datasets/utils';

// Chart tool integration point

// Heuristic to detect when the user is asking for a visualization
// Simple keyword list to catch common chart intents, including German phrasing.
const chartKeywords = [
  'plot',
  'chart',
  'diagram',
  'visualisier',
  'visualise',
  'visualize',
  'grafik',
  'graph',
  'abbildung',
  'balken',
  'saeule',
  'saule',
  'balkendiagramm',
  'linien diagramm',
  'liniendiagramm',
  'line chart',
  'scatter',
  'heatmap',
  'histogram',
  'verteilung',
];

const looksLikeChart = (q: string) => {
  const normalized = q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return chartKeywords.some((keyword) => normalized.includes(keyword));
};

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
});

const MainAssistantInputSchema = z.object({
  question: z.string().describe("The user's current question."),
  history: z.array(MessageSchema).optional().describe("The conversation history."),
  datasetId: z.string().uuid().describe('The dataset identifier selected by the user.'),
});
export type MainAssistantInput = z.infer<typeof MainAssistantInputSchema>;

const MainAssistantOutputSchema = z.object({
  answer: z.string().describe('The final answer to be displayed to the user.'),
  sqlQuery: z.string().optional().describe('The SQL query that was executed.'),
  retrievedContext: z.string().optional().describe('The context retrieved from the vector database.'),
  chart: VisualizationChartMessageSchema.optional(),
  statistics: StatisticsAnalysisSchema.optional(),
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
  needsStatistics: z
    .boolean()
    .describe(
      'True if the question asks for regression/effects/prediction/coefficients or a significance test (e.g., group differences).',
    ),
  analysisType: z
    .enum(['linearRegression', 'randomForestRegression', 'independentTTest'])
    .optional(),
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

    if (!isAiConfigured) {
      return {
        answer: missingAiMessage,
      };
    }

    const dataset = await getDatasetMetadata(input.datasetId);
    if (!dataset) {
      return {
        answer: 'The selected dataset could not be found. Please upload or select a dataset before asking questions.',
      };
    }

    if (dataset.status !== 'ready') {
      return {
        answer: `The dataset "${dataset.title}" is not ready yet (status: ${dataset.status}). Please wait for processing to finish.`,
      };
    }

    const datasetContext = getDatasetPromptContext(dataset);
    const retrievedContext = datasetContext.summary;
    const allowedColumns = datasetContext.allowedColumns;
    const missingValueMap = datasetContext.missingValueMap;
    const tableName = datasetTableName(dataset.id);
    const datasetToolContext = {
      id: dataset.id,
      title: dataset.title,
      rowCount: dataset.rowCount,
      tableName,
      context: retrievedContext,
      columns: dataset.columns,
      defaultMissingValues: dataset.defaultMissingValues ?? [],
      weightColumn: dataset.weightColumn ?? null,
    };


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
      model: 'openai/gpt-5',
      prompt: reformulationPrompt,
      output: { schema: ReformulatedQuestionSchema },
    });

    const { reformulatedQuestion, requiresTool } = reformulationResponse.output!;
    console.log('[mainAssistantFlow] Reformulation result:', JSON.stringify({ reformulatedQuestion, requiresTool }, null, 2));

    // ✨ NEU: Direkt nach der Reformulierung – Chart-Fall vorziehen
    if (looksLikeChart(reformulatedQuestion)) {
      console.log('[mainAssistantFlow] Chart intent detected. Generating visualization payload...');
      const clientChartId = randomUUID();
      const visualization = await generateVisualization({
        nlQuestion: reformulatedQuestion,
        history: input.history,
        clientChartId,
        dataset: datasetToolContext,
      });

      if (visualization.status === 'error' || !visualization.chart || !visualization.meta?.request) {
        return {
          answer:
            `Die Grafik konnte nicht erzeugt werden.\n${visualization.error?.message ?? ''}\n\n` +
            `Tipp: Beschreibe knapp, welche Variablen auf die Achsen sollen und welche Aggregation du erwartest.`,
          retrievedContext: visualization.chart?.retrievedContext,
          sqlQuery: visualization.chart?.sqlQuery,
        };
      }

      const interpretation =
        visualization.chart.interpretation?.trim();
      const subtitle =
        visualization.chart.caption?.trim() ||
        'Hier ist die automatisch generierte Visualisierung. Du kannst sie mit den Tools im Interface weiter anpassen.';
      const answer = interpretation && interpretation.length > 0 ? interpretation : subtitle;

      return {
        answer,
        sqlQuery: visualization.chart.sqlQuery,
        retrievedContext: visualization.chart.retrievedContext,
        chart: {
          ...visualization.chart,
          id: visualization.chart.id,
          request: visualization.meta.request,
        },
      };
    }

    if (!requiresTool) {
      // If no tool is needed, generate a direct answer.
      console.log('[mainAssistantFlow] No tool required. Generating a direct answer.');
      const directAnswerResponse = await ai.generate({
        model: 'openai/gpt-5',
        prompt: `Answer the following user question: "${reformulatedQuestion}"`,
      });
      return { answer: directAnswerResponse.text, retrievedContext };
    }

    const formattedAllowedColumns =
      allowedColumns.length > 0 ? allowedColumns.map((column) => `- ${column}`).join('\n') : '(No columns detected)';

    const missingValueEntries = Object.entries(missingValueMap)
      .map(([columnName, values]) => ({
        columnName,
        values: values.filter((value) => value !== ''),
      }))
      .filter(({ values }) => values.length > 0);

    const missingValueSummary =
      missingValueEntries.length > 0
        ? missingValueEntries
            .map(({ columnName, values }) => {
              const limit = 6;
              const displayed = values.slice(0, limit);
              const suffix = values.length > limit ? `, ... (+${values.length - limit} more)` : '';
              return `- ${columnName}: ${displayed.join(', ')}${suffix}`;
            })
            .join('\n')
        : '- (no column-specific sentinel values beyond the global defaults)';

    const statsPrompt = `Decide whether the user's question requires a statistical analysis. You can choose between:
- linearRegression: classic OLS regression for interpretable coefficients.
- randomForestRegression: non-linear regression if the relationship is complex.
- independentTTest: compare the mean of a numeric target between exactly two groups.

Set needsStatistics=true only when the question explicitly asks for effects, predictions, model estimates, or significance testing (e.g., "Is there a significant difference between..."). Otherwise keep needsStatistics=false.

STRICT RULES:
- Use variable names EXACTLY as they appear in the dataset overview below.
- Do NOT invent, rename, or reformat variable names.
- Only use column names that appear in the ALLOWED COLUMNS list below. If a required variable is missing from both the overview and the allowed list, set needsStatistics=false and provide a brief reason.
- Respect the missing value rules for each column. Avoid using records with these sentinel values.
- If a weight column is provided, mention it in the plan but the downstream tool will apply it automatically.
- For independentTTest specify the numeric outcome in target and provide exactly one grouping variable in features[]. For regressions supply the predictor variables in features[].

DATASET OVERVIEW:
${retrievedContext}

ALLOWED COLUMNS (table "${tableName}"):
${formattedAllowedColumns}

MISSING VALUE RULES:
${missingValueSummary}

QUESTION:
"${reformulatedQuestion}"`;

    let statsOutput: any | null = null;
    try {
      const statsExtraction = await ai.generate({
        model: 'openai/gpt-5',
        prompt: statsPrompt,
        output: { schema: StatsExtractionSchema },
      });
      const plan = statsExtraction.output!;
      console.log('[mainAssistantFlow] Stats extraction:', JSON.stringify(plan, null, 2));

      // Run statisticsTool directly when statistical analysis is required (it fetches its own SQL data)
      if (plan?.needsStatistics) {
        const analysisType = (plan.analysisType ?? 'linearRegression') as
          | 'linearRegression'
          | 'randomForestRegression'
          | 'independentTTest';
        statsOutput = await statisticsTool({
          dataset: datasetToolContext,
          analysisType,
          target: String(plan.target || '').trim(),
          features: Array.isArray(plan.features) ? plan.features : [],
          filters: plan.filters,
        } as any);
        console.log('[mainAssistantFlow] statisticsTool output:', JSON.stringify(statsOutput, null, 2));

        let structuredStatistics: z.infer<typeof StatisticsAnalysisSchema> | undefined;
        if (statsOutput?.result) {
          const parsed = StatisticsAnalysisSchema.safeParse(statsOutput.result);
          if (parsed.success) {
            structuredStatistics = parsed.data;
          } else {
            console.warn('[mainAssistantFlow] Failed to parse statistics result:', parsed.error);
          }
        }

        const finalPrompt = `You are an expert data analyst and assistant for the dataset "${dataset.title}".
User's original question: "${input.question}"
Reformulated question: "${reformulatedQuestion}"

Statistical result:
${JSON.stringify(statsOutput, null, 2)}

Dataset overview:
${retrievedContext}

Write a clear, user-friendly answer based on the statistical result. If there was an error, explain it and suggest next steps.`;

        const finalLlmResponse = await ai.generate({ model: 'openai/gpt-5', prompt: finalPrompt });
        const answer = finalLlmResponse.text;

        return {
          answer,
          sqlQuery: String(statsOutput?.sqlQuery || ''), // SQL aus statisticsTool, falls vorhanden
          retrievedContext,
          statistics: structuredStatistics,
        };
      }
    } catch (e) {
      console.warn('[mainAssistantFlow] Regression planning or run failed; falling back to SQL tool:', e);
      // wenn Planung scheitert, normal weiter unten
    }

    // Step 4: Kein Regressionsbedarf → executeQueryTool wie gehabt
    console.log(`[mainAssistantFlow] Tool required. Executing query for: "${reformulatedQuestion}"`);
    const toolOutput = await executeQueryTool({
      dataset: datasetToolContext,
      nlQuestion: reformulatedQuestion,
      history: input.history,
    });
    console.log('[mainAssistantFlow] Tool output received:', JSON.stringify(toolOutput, null, 2));

    const finalPrompt = `You are an expert data analyst and assistant for the dataset "${dataset.title}".
You have just executed a query to answer the user's question.

User's original question: "${input.question}"
The reformulated question used for the query: "${reformulatedQuestion}"

Here is the result from the database tool:
${JSON.stringify(toolOutput, null, 2)}

Dataset overview:
${retrievedContext}

Now, formulate a final, user-friendly answer based on the tool's output. If there was an error, state it clearly and suggest next steps.`;

    const finalLlmResponse = await ai.generate({ model: 'openai/gpt-5', prompt: finalPrompt });
    const answer = finalLlmResponse.text;

    return {
      answer,
      sqlQuery: String(toolOutput.sqlQuery || ''),
      retrievedContext,
    };
  }
);
