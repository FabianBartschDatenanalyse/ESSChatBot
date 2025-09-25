import { z } from 'zod';

export const ChartSeriesSchema = z.object({
  key: z
    .string()
    .describe('The key used for rendering the series in the visualization output.'),
  label: z
    .string()
    .optional()
    .describe('Human friendly label that should be displayed for the series.'),
  dataKey: z
    .string()
    .optional()
    .describe(
      'Optional raw field name to read values from. Useful when the rendered key should differ from the column name.',
    ),
  color: z
    .string()
    .optional()
    .describe('Preferred color for the series (CSS color value such as hex, rgb, or hsl).'),
  axis: z
    .enum(['left', 'right'])
    .optional()
    .describe('Selects the Y-axis to use when rendering multi-axis charts.'),
  stackId: z
    .string()
    .optional()
    .describe('Optional stack identifier for stacked visualizations.'),
});

export const ChartDefinitionSchema = z.object({
  type: z.enum(['bar', 'line', 'area', 'pie']),
  xKey: z.string(),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  yLabelSecondary: z.string().optional(),
  series: z.array(ChartSeriesSchema).min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  data: z.array(z.record(z.any())).default([]),
});
export type ChartDefinition = z.infer<typeof ChartDefinitionSchema>;

/**
 * Defines the structure for a single message in a conversation.
 * This is used for both client-side state management and server-side AI processing.
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  sqlQuery: z.string().optional(),
  retrievedContext: z.string().optional(),
  chart: ChartDefinitionSchema.optional(),
});
export type Message = z.infer<typeof MessageSchema>;

/**
 * Defines the structure for a conversation, including its ID, title,
 * and the list of messages it contains.
 */
export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

    
