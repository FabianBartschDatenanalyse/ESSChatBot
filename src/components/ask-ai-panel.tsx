
'use client';

import { mainAssistant } from '@/ai/flows/main-assistant-flow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCodebookAsString } from '@/lib/codebook';
import type { Message } from '@/lib/types';
import { Bot, Code2, Loader2, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

export default function AskAiPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { id: uuidv4(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sqlQuery: '',
      retrievedContext: '',
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const assistantResponse = await mainAssistant({
        question: input,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      });
      
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: assistantResponse.answer,
                sqlQuery: assistantResponse.sqlQuery || '',
                retrievedContext: assistantResponse.retrievedContext || '',
              }
            : m
        )
      );
    } catch (e: any) {
      const errorMsg = `Sorry, I encountered an error: ${e.message || 'Unknown error'}`;
      setError(errorMsg);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessageId ? { ...m, content: errorMsg } : m))
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-lg font-headline">Ask the Assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow gap-4 overflow-hidden">
        <div className="flex-grow overflow-y-auto pr-4 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <Bot className="w-6 h-6 text-primary" />}
              <div className={`p-3 rounded-lg max-w-4xl ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <div dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }} />
                {message.role === 'assistant' && (message.sqlQuery || message.retrievedContext) && (
                  <Accordion type="single" collapsible className="w-full mt-2">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2 text-xs">
                          <Code2 className="w-4 h-4" />
                          Show Details
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {message.sqlQuery && message.sqlQuery.trim().length > 0 ? (
                           <pre className="bg-gray-800 text-white p-2 rounded-md text-xs overflow-x-auto">
                              <code>{message.sqlQuery}</code>
                           </pre>
                        ) : (
                           <p className="text-xs text-muted-foreground">Not provided by the tool.</p>
                        )}
                        {message.retrievedContext && (
                           <>
                           <h4 className="font-semibold mt-4 mb-2 text-xs">Retrieved Context:</h4>
                           <pre className="bg-gray-800 text-white p-2 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                              <code>{message.retrievedContext}</code>
                           </pre>
                           </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
              {message.role === 'user' && <User className="w-6 h-6 text-primary" />}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., What is the average trust in parliament per country?"
            className="flex-grow"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
