"use client";

export const runtime = 'nodejs';

import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { mainAssistant } from "@/src/ai/flows/main-assistant-flow";

import { Form, FormControl, FormField, FormItem } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/src/components/ui/avatar";
import { Loader2, Send, Code2, Database } from "lucide-react";
import { type Conversation, type Message } from "@/src/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/src/components/ui/accordion";

// ✨ Markdown-Renderer für Bilder/Formatierung
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const formSchema = z.object({
  question: z.string().min(1, "Question cannot be empty."),
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

  // 🔎 kleine Helfer
  const hasDataPng = (s?: string) => /data:image\/png;base64,/.test(s || "");
  const extractFirstDataPng = (s?: string) =>
    (s || "").match(/data:image\/png;base64,[A-Za-z0-9+/=]+/)?.[0];

  // 🔧 Debug-Log pro Message (nur temporär; zeigt, ob data:image PNG im Markdown steckt)
  useEffect(() => {
    messages.forEach((m, i) => {
      if (m.role === "assistant") {
        const found = hasDataPng(m.content);
        if (found) {
          console.log(`[AskAiPanel] msg#${i} enthält data:image PNG`);
        }
      }
    });
  }, [messages]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { question: "" },
  });

  // 🆕 Flag, ob das Markdown-<img> wirklich gerendert wurde (wird pro Message-Zeile zurückgesetzt)
  const imgRenderedRef = React.useRef(false);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const userMessage: Message = { role: "user", content: values.question };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    form.reset();

    try {
      const historyForApi = newMessages.map(({ role, content }) => ({ role, content }));

      const result = await mainAssistant({
        question: values.question,
        history: historyForApi,
      });

      console.log("[AskAiPanel] Result from mainAssistant:", result);

      const assistantMessage: Message = {
        role: "assistant",
        content: result.answer, // kann Markdown + data:image/png enthalten
        sqlQuery: result.sqlQuery,
        retrievedContext: result.retrievedContext,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      onMessagesUpdate(conversation.id, finalMessages);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
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
          {messages.map((message, index) => {
            const dataUrl = extractFirstDataPng(message.content);

            // 🧹 pro Nachricht zurücksetzen – wird vom <img>-Renderer auf true gesetzt
            imgRenderedRef.current = false;

            return (
              <div
                key={index}
                className={`flex items-start gap-4 ${
                  message.role === "user" ? "justify-end" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-9 w-9 bg-transparent overflow-hidden border-0">
                    {Boolean(
                      "https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-07-28%20154109.png?alt=media&token=5ca90387-7aba-4a39-8a9c-c386d7aaaacf"
                    ) && (
                      <AvatarImage
                        src="https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-07-28%20154109.png?alt=media&token=5ca90387-7aba-4a39-8a9c-c386d7aaaacf"
                        alt="AI Assistant Icon"
                        className="h-full w-full object-contain bg-transparent"
                      />
                    )}
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`rounded-lg p-3 max-w-[80%] ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {/* ✨ Markdown statt Plaintext – zeigt PNG (data URL), Tabellen, Code, etc. */}
                  <div className="text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        img: ({ node, src, alt, ...props }) => {
                          if (!src || src.trim() === "") return null;
                          // 🆕 merken, dass das Markdown-<img> gerendert wurde
                          imgRenderedRef.current = true;
                          return (
                            <img
                              src={src}
                              alt={typeof alt === "string" ? alt : ""}
                              className="max-w-full h-auto rounded-md shadow-sm mt-2"
                              {...props}
                            />
                          );
                        },
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            className="underline underline-offset-2"
                            target="_blank"
                            rel="noreferrer"
                          />
                        ),
                        code: ({ node, className, children, ...props }) => {
                          const isInline = !className; // einfache Heuristik
                          return (
                            <code
                              {...props}
                              className={`font-mono ${
                                isInline ? "px-1 py-0.5 rounded bg-background/50" : ""
                              } ${className || ""}`}
                            >
                              {children}
                            </code>
                          );
                        },
                        pre: ({ node, ...props }) => (
                          <pre
                            {...props}
                            className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto max-h-96"
                          />
                        ),
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto">
                            <table {...props} className="text-xs border-collapse w-full" />
                          </div>
                        ),
                        th: ({ node, ...props }) => (
                          <th {...props} className="text-left font-semibold border-b px-2 py-1" />
                        ),
                        td: ({ node, ...props }) => (
                          <td {...props} className="border-b px-2 py-1 align-top" />
                        ),
                        p: ({ node, ...props }) => <p {...props} className="mb-2" />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>

                  {/* ✅ Fallback NUR wenn Markdown KEIN Bild gerendert hat */}
                  {message.role === "assistant" && dataUrl && !imgRenderedRef.current && (
                    <div className="mt-2">
                      <img
                        src={dataUrl}
                        alt="Chart"
                        className="max-w-full h-auto rounded-md shadow-sm"
                      />
                    </div>
                  )}

                  {(message.sqlQuery || message.retrievedContext) && (
                    <Accordion type="single" collapsible className="w-full mt-2">
                      <AccordionItem value="details" className="border-0">
                        <AccordionTrigger className="text-xs py-1 hover:no-underline">
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
                                <code className="font-mono break-words whitespace-pre-wrap">
                                  {message.sqlQuery}
                                </code>
                              </pre>
                            </div>
                          )}
                          {(!message.sqlQuery || message.sqlQuery.trim().length === 0) &&
                            message.role === "assistant" && (
                              <div className="space-y-2 mt-2">
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                  <Code2 className="h-4 w-4" />
                                  SQL Query
                                </h4>
                                <pre className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto max-h-40 overflow-y-auto">
                                  <code className="font-mono text-muted-foreground break-words whitespace-pre-wrap">
                                    Not provided by the tool.
                                  </code>
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
                                <code className="font-sans break-words whitespace-pre-wrap">
                                  {message.retrievedContext}
                                </code>
                              </pre>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>

                {message.role === "user" && (
                  <Avatar className="h-9 w-9 bg-transparent border-0 overflow-hidden">
                    {Boolean(
                      "https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-08-05%20173336.png?alt=media&token=043f7832-d24c-44ae-9859-522233a4d1a5"
                    ) && (
                      <AvatarImage
                        src="https://firebasestorage.googleapis.com/v0/b/ess-navigator-nnbqm.firebasestorage.app/o/Screenshot%202025-08-05%20173336.png?alt=media&token=043f7832-d24c-44ae-9859-522233a4d1a5"
                        alt="User Science Icon"
                        className="h-full w-full object-contain bg-transparent"
                      />
                    )}
                    <AvatarFallback className="hidden">YOU</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}

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
                    <Input
                      placeholder="e.g., What is the average trust in parliament per country?"
                      {...field}
                      disabled={isLoading}
                    />
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
