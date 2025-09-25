"use client";

import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Form, FormControl, FormField, FormItem } from '@/src/components/ui/form';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/src/components/ui/avatar';
import { Loader2, Send } from 'lucide-react';
import { type Conversation, type Message } from '@/src/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/src/components/ui/accordion';
import { Code2, Database } from 'lucide-react';
import Logo from '@/src/components/logo';
import { ChatVisualization } from '@/src/components/chat-visualization';
import type { MainAssistantOutput } from '@/src/ai/flows/main-assistant-flow';

const UNKNOWN_ASSISTANT_ERROR_MESSAGE = 'Assistant service reported an unknown error.';

const formatAssistantError = (rawError: unknown): string => {
  if (!rawError) {
    return UNKNOWN_ASSISTANT_ERROR_MESSAGE;
  }

  if (typeof rawError === 'string') {
    return rawError;
  }

  if (rawError instanceof Error && rawError.message) {
    return rawError.message;
  }

  if (typeof rawError === 'object') {
    const errorObject = rawError as Record<string, unknown>;

    if (typeof errorObject.message === 'string' && errorObject.message.trim().length > 0) {
      return errorObject.message;
    }

    if (typeof errorObject.error === 'string' && errorObject.error.trim().length > 0) {
      return errorObject.error;
    }

    try {
      const serialized = JSON.stringify(errorObject);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch (serializationError) {
      console.error('[AskAiPanel] Failed to serialize assistant error object:', serializationError, errorObject);
    }
  }

  return UNKNOWN_ASSISTANT_ERROR_MESSAGE;
};

const formSchema = z.object({
  question: z
    .string()
    .transform(value => value.trim())
    .pipe(z.string().min(1, 'Question cannot be empty.')),
});

interface AskAiPanelProps {
  conversation: Conversation;
  onMessagesUpdate: (conversationId: string, messages: Message[]) => void;
}

type AssistantResponse = MainAssistantOutput & { error?: string };

export default function AskAiPanel({ conversation, onMessagesUpdate }: AskAiPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [messagesState, setMessagesState] = useState<Message[]>(conversation.messages);
  const messagesRef = useRef<Message[]>(conversation.messages);
  const messages = messagesState;

  const setMessages = useCallback(
    (updater: Message[] | ((previous: Message[]) => Message[])) => {
      setMessagesState(prev => {
        const next = typeof updater === 'function' ? (updater as (value: Message[]) => Message[])(prev) : updater;
        messagesRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    messagesRef.current = conversation.messages;
    setMessages(conversation.messages);
  }, [conversation, setMessages]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const question = values.question.trim();

    const userMessage: Message = { role: 'user', content: question };
    const newMessages = [...messagesRef.current, userMessage];
    let latestMessages = newMessages;

    const commitMessages = (
      nextMessages: Message[],
      options: { suppressErrors?: boolean } = {}
    ) => {
      const { suppressErrors = false } = options;

      if (suppressErrors) {
        try {
          setMessages(nextMessages);
        } catch (stateUpdateError) {
          console.error('[AskAiPanel] Failed to update local messages state:', stateUpdateError);
        }

        try {
          onMessagesUpdate(conversation.id, nextMessages);
        } catch (propError) {
          console.error('[AskAiPanel] Failed to propagate messages update:', propError);
        }
      } else {
        setMessages(nextMessages);
        onMessagesUpdate(conversation.id, nextMessages);
      }

      latestMessages = nextMessages;
    };

    setIsLoading(true);
    form.reset();

    try {
      commitMessages(newMessages);

      // Pass only the essential parts of the history, excluding context and queries
      // Include the latest user prompt when sending the conversation history to the API.
      // Using the local `newMessages` array ensures the freshly added user question
      // is part of the request payload instead of relying on the slightly stale
      // `messages` state snapshot captured prior to calling `setMessages`.
      const historyForApi = newMessages.map(({ role, content }) => ({ role, content }));

      const response = await fetch('/api/main-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          history: historyForApi,
        }),
      });

      const responseText = await response.text();
      let result: AssistantResponse | { error?: string } | null = null;

      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[AskAiPanel] Failed to parse assistant response as JSON:', parseError, responseText);
          throw new Error('Received an invalid response from the assistant service.');
        }
      }

      if (!response.ok) {
        throw new Error(result?.error ?? `Failed to fetch assistant response. (status ${response.status})`);
      }

      if (!result || typeof result !== 'object') {
        throw new Error('Assistant response was empty. Please try again.');
      }

      if ('error' in result && result.error) {
        throw new Error(formatAssistantError(result.error));
      }

      if (!('answer' in result) || typeof result.answer !== 'string') {
        throw new Error('Assistant response was missing the final answer.');
      }

      const typedResult = result as AssistantResponse;

      console.log('[AskAiPanel] Result from mainAssistant:', typedResult); // <--- HIER

      const assistantMessage: Message = {
        role: 'assistant',
        content: typedResult.answer,
        sqlQuery: typedResult.sqlQuery,
        retrievedContext: typedResult.retrievedContext,
        chart: typedResult.chart,
      };
      
      const finalMessages = [...newMessages, assistantMessage];
      commitMessages(finalMessages);

    } catch (error) {
      console.error(error);
      const fallbackError = 'Sorry, I encountered an error. Please try again.';
      const formattedError = formatAssistantError(error);
      const errorText = formattedError === UNKNOWN_ASSISTANT_ERROR_MESSAGE ? fallbackError : formattedError;
      const errorMessage: Message = { role: 'assistant', content: errorText };
      const finalMessages = [...latestMessages, errorMessage];
      commitMessages(finalMessages, { suppressErrors: true });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[65vh] flex-col">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && (
                <Avatar className="h-9 w-9 bg-transparent overflow-hidden border-0">
                  <AvatarImage
                    src="https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-07-28%20154109.png?alt=media&token=5ca90387-7aba-4a39-8a9c-c386d7aaaacf"
                    alt="AI Assistant Icon"
                    className="h-full w-full object-contain bg-transparent"
                  />
                </Avatar>
              )}
              <div className={`rounded-lg p-3 max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                {message.chart && (
                  <div className="mt-3 rounded-lg border bg-background/70 p-3">
                    <ChatVisualization chart={message.chart} />
                  </div>
                )}
                {(message.sqlQuery || message.retrievedContext) && (
                   <Accordion type="single" collapsible className="w-full mt-2">
                      <AccordionItem value="details" className='border-0'>
                        <AccordionTrigger className='text-xs py-1 hover:no-underline'>
                          Show Details
                        </AccordionTrigger>
                        <AccordionContent>
                           {message.sqlQuery && message.sqlQuery.trim().length > 0 && (
                            <div className="space-y-2 mt-2">
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                    <Code2 className="h-4 w-4" />
                                    SQL Query
                                </h4>
                                <pre className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto max-h-40 overflow-y-auto">
                                    <code className="font-mono break-words whitespace-pre-wrap">{message.sqlQuery}</code>
                                </pre>
                            </div>
                           )}
                           {(!message.sqlQuery || message.sqlQuery.trim().length === 0) && message.role === 'assistant' && (
                            <div className="space-y-2 mt-2">
                              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                <Code2 className="h-4 w-4" />
                                SQL Query
                              </h4>
                              <pre className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto max-h-40 overflow-y-auto">
                                <code className="font-mono text-muted-foreground break-words whitespace-pre-wrap">Not provided by the tool.</code>
                              </pre>
                            </div>
                           )}
                           {message.retrievedContext && (
                            <div className="space-y-2 mt-4">
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                    <Database className="h-4 w-4" />
                                    Retrieved Context
                                </h4>
                                <pre className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    <code className="font-sans break-words whitespace-pre-wrap">{message.retrievedContext}</code>
                                </pre>
                            </div>
                           )}
                        </AccordionContent>
                      </AccordionItem>
                   </Accordion>
                )}
              </div>
               {message.role === 'user' && (
                <Avatar className="h-9 w-9 bg-transparent border-0 overflow-hidden">
                  <AvatarImage
                    src="https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-08-05%20173336.png?alt=media&token=043f7832-d24c-44ae-9859-522233a4d1a5"
                    alt="User Science Icon"
                    className="h-full w-full object-contain bg-transparent"
                  /> 
                   <AvatarFallback className="hidden">YOU</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
              <div className="flex items-start gap-4">
                <Avatar className="h-9 w-9 bg-transparent overflow-hidden border-0">
                  <AvatarImage
                    src="https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-07-28%20154109.png?alt=media&token=5ca90387-7aba-4a39-8a9c-c386d7aaaacf"
                    alt="AI Assistant Icon"
                    className="h-full w-full object-contain bg-transparent"
                    />
                </Avatar>
                  <div className="rounded-lg p-3 bg-muted flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="e.g., What is the average trust in parliament per country?" {...field} disabled={isLoading} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

    