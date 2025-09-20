'use server';

import { ai } from '@/src/ai/genkit';
import { z } from 'zod';

const chartSeriesSchema = z.object({
  key: z.string().describe('The data field to visualize.'),
  label: z.string().optional().describe('Human friendly name for the series.'),
});

const chartPlanSchema = z.object({
  type: z.enum(['bar', 'line', 'area', 'pie']).describe('Preferred visualization type.'),
  xKey: z.string().describe('Field to use for the horizontal axis or category.'),
  series: z.array(chartSeriesSchema).min(1).describe('One or more data series to render.'),
  title: z.string().optional().describe('Suggested title for the chart.'),
  description: z.string().optional().describe('Short narrative explaining what the chart shows.'),
});

const toolInputSchema = z.object({
  question: z.string().describe('Original natural language question requesting the visualization.'),
  dataPreview: z
    .array(z.record(z.any()))
    .min(1)
    .max(20)
    .describe('Preview of the tabular data that should be visualized.'),
});

export type VisualizationPlan = z.infer<typeof chartPlanSchema>;

export const visualizationTool = ai.defineTool(
  {
    name: 'visualizationTool',
    description:
      'Design a professional data visualization that best communicates the provided dataset in the context of the user question.',
    inputSchema: toolInputSchema,
    outputSchema: chartPlanSchema,
  },
  async (input) => {
    const prompt = `You are a senior data visualization designer. Create a clear and professional chart specification.

USER QUESTION:
${input.question}

DATA PREVIEW (first rows from SQL result):
${JSON.stringify(input.dataPreview, null, 2)}

REQUIREMENTS:
- Pick the most appropriate chart type among bar, line, area, or pie.
- Use column names exactly as they appear in the data preview.
- Respond strictly as JSON that matches the provided schema.
- Prefer grouped/stacked charts if multiple metrics share the same categories.
- Provide a concise title and description when helpful.
`;

    const response = await ai.generate({
      model: 'openai/gpt-4o',
      prompt,
      output: { schema: chartPlanSchema },
    });

    return response.output!;
  },
);
