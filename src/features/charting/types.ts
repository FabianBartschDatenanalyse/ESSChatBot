import { z } from 'zod';

const ConversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
});

export const VisualizationRequestSchema = z.object({
  nlQuestion: z.string().min(3, 'A natural language question is required.'),
  history: z.array(ConversationTurnSchema).optional(),
  clientChartId: z.string().optional(),
});
export type VisualizationRequest = z.infer<typeof VisualizationRequestSchema>;

export const VisualizationErrorSchema = z.object({
  message: z.string(),
  details: z.string().optional(),
});
export type VisualizationError = z.infer<typeof VisualizationErrorSchema>;

export const VisualizationChartSchema = z.object({
  id: z.string(),
  config: z.any(),
  title: z.string().optional(),
  caption: z.string().optional(),
  sqlQuery: z.string().optional(),
  retrievedContext: z.string().optional(),
});
export type VisualizationChart = z.infer<typeof VisualizationChartSchema>;

export const VisualizationResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  chart: VisualizationChartSchema.optional(),
  error: VisualizationErrorSchema.optional(),
  meta: z
    .object({
      generatedAt: z.string(),
      request: VisualizationRequestSchema,
    })
    .optional(),
});
export type VisualizationResponse = z.infer<typeof VisualizationResponseSchema>;

export const VisualizationChartMessageSchema = VisualizationChartSchema.extend({
  request: VisualizationRequestSchema,
});
export type VisualizationChartMessage = z.infer<typeof VisualizationChartMessageSchema>;

