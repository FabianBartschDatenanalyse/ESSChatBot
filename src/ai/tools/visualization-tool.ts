'use server';

import { ai } from '@/src/ai/genkit';
import { z } from 'zod';

const chartSeriesSchema = z.object({
  key: z.string().describe('The data field to visualize.'),
  label: z.string().optional().describe('Human friendly name for the series.'),
  dataKey: z
    .string()
    .optional()
    .describe(
      'Optional raw field to read values from when the displayed key should differ from the column name.',
    ),
  color: z.string().optional().describe('Preferred CSS color token (hex, rgb, hsl) for the series.'),
  axis: z
    .enum(['left', 'right'])
    .optional()
    .describe('Selects which Y-axis to map the series to for dual-axis charts.'),
  stackId: z
    .string()
    .optional()
    .describe('Stack identifier used to combine related series in stacked charts.'),
});

const chartPlanSchema = z.object({
  type: z.enum(['bar', 'line', 'area', 'pie']).describe('Preferred visualization type.'),
  xKey: z.string().describe('Field to use for the horizontal axis or category.'),
  xLabel: z.string().optional().describe('Label to display underneath the X-axis.'),
  yLabel: z.string().optional().describe('Label to display beside the primary Y-axis.'),
  yLabelSecondary: z
    .string()
    .optional()
    .describe('Label to display beside the secondary Y-axis when one is required.'),
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
- Use column names exactly as they appear in the data preview. If you need to rename a series, keep the original column name in "dataKey" and use "key" for the rendered label.
- Respond strictly as JSON that matches the provided schema.
- Prefer grouped/stacked charts if multiple metrics share the same categories (set "stackId" when stacking is desired).
- Use the "axis" property to place specific series on a secondary Y-axis when scales differ substantially.
- Provide a concise title and description when helpful.
- Include axis labels when they improve readability.
`;

    const response = await ai.generate({
      model: 'openai/gpt-4o',
      prompt,
      output: { schema: chartPlanSchema },
    });

    return response.output!;
  },
);
