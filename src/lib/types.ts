import { z } from 'zod';
import { VisualizationChartMessageSchema } from '@/src/features/charting/types';

/**
 * Defines the structure for a single message in a conversation.
 * This is used for both client-side state management and server-side AI processing.
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  sqlQuery: z.string().optional(),
  retrievedContext: z.string().optional(),
  chart: VisualizationChartMessageSchema.optional(),
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

    
