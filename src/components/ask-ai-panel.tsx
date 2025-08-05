"use client";

import React from 'react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { mainAssistant } from '@/src/ai/flows/main-assistant-flow';

import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send } from 'lucide-react';
import { type Conversation, type Message } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Code2, Database } from 'lucide-react';
import Logo from './logo';

const formSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty.'),
});

interface AskAiPanelProps {
  conversation: Conversation;
  onMessagesUpdate: (conversationId: string, messages: Message[]) => void;
}

export default function AskAiPanel({ conversation, onMessagesUpdate }: AskAiPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(conversation.messages);

  useEffect(() => {
    setMessages(conversation.messages);
  }, [conversation]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const userMessage: Message = { role: 'user', content: values.question };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    form.reset();

    try {
      // Pass only the essential parts of the history, excluding context and queries
      const historyForApi = messages.map(({ role, content }) => ({ role, content }));
      
      const result = await mainAssistant({ 
        question: values.question, 
        history: historyForApi
      });

      console.log('[AskAiPanel] Result from mainAssistant:', result); // <--- HIER

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.answer,
        sqlQuery: result.sqlQuery,
        retrievedContext: result.retrievedContext,
      };
      
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      onMessagesUpdate(conversation.id, finalMessages);

    } catch (error) {
      console.error(error);
      const errorMessage: Message = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      onMessagesUpdate(conversation.id, finalMessages);
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
                    src="https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-08-05%20075425.png?alt=media&token=77aae284-b3d4-4b92-9005-8d035078e900"
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

    