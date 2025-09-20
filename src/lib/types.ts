import { z } from 'zod';

export const ChartSeriesSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
});

export const ChartDefinitionSchema = z.object({
  type: z.enum(['bar', 'line', 'area', 'pie']),
  xKey: z.string(),
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

    
