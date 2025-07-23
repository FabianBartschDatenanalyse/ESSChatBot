"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { mainAssistant } from '@/ai/flows/main-assistant-flow';

import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send } from 'lucide-react';
import Logo from './logo';
import type { Conversation, Message } from './dashboard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Code2, Database } from 'lucide-react';

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
      // Pass the existing messages as history
      const history = messages.map(({ role, content }) => ({ role, content: content as string, tool_calls: [] }));
      const result = await mainAssistant({ question: values.question, history: history.map(m => ({role: m.role, content: m.content})) as any[]});
      
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
                <Avatar className="h-9 w-9 border border-primary/20">
                    <div className='flex h-full w-full items-center justify-center bg-primary text-primary-foreground'>
                        <Logo className='h-5 w-5' />
                    </div>
                </Avatar>
              )}
              <div className={`rounded-lg p-3 max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {(message.sqlQuery || message.retrievedContext) && message.role === 'assistant' && (
                   <Accordion type="single" collapsible className="w-full mt-2">
                      <AccordionItem value="details" className='border-0'>
                        <AccordionTrigger className='text-xs py-1 hover:no-underline'>
                          Show Details
                        </AccordionTrigger>
                        <AccordionContent>
                           {message.sqlQuery && (
                            <div className="space-y-2 mt-2">
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                    <Code2 className="h-4 w-4" />
                                    SQL Query
                                </h4>
                                <pre className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto">
                                    <code className="font-mono">{message.sqlQuery}</code>
                                </pre>
                            </div>
                           )}
                           {message.retrievedContext && (
                            <div className="space-y-2 mt-2">
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                    <Database className="h-4 w-4" />
                                    Retrieved Context
                                </h4>
                                <pre className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                                    <code className="font-sans">{message.retrievedContext}</code>
                                </pre>
                            </div>
                           )}
                        </AccordionContent>
                      </AccordionItem>
                   </Accordion>
                )}
              </div>
               {message.role === 'user' && (
                <Avatar className="h-9 w-9">
                  <AvatarFallback>YOU</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-4">
                <Avatar className="h-9 w-9 border border-primary/20">
                    <div className='flex h-full w-full items-center justify-center bg-primary text-primary-foreground'>
                        <Logo className='h-5 w-5' />
                    </div>
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

    