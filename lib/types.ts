import { z } from 'zod';

/**
 * Defines the structure for a single message in a conversation.
 * This is used for both client-side state management and server-side AI processing.
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  sqlQuery: z.string().optional(),
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
