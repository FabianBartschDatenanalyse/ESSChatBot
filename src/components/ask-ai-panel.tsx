"use client";

export const runtime = 'nodejs';

import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { MainAssistantOutput } from "@/src/ai/flows/main-assistant-flow";

import { Form, FormControl, FormField, FormItem } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/src/components/ui/avatar";
import { Loader2, Send, Code2, Database } from "lucide-react";
import { type Conversation, type Message } from "@/src/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/src/components/ui/accordion";
import { ChartShell } from "@/src/features/charting/components/chart-shell";
import { VegaChart } from "@/src/features/charting/components/vega-chart";

interface InlineRenderResult {
  nodes: React.ReactNode[];
  containsImage: boolean;
}

const findClosingParen = (value: string, openIndex: number) => {
  let depth = 0;
  for (let i = openIndex; i < value.length; i += 1) {
    const char = value[i];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
};

const renderInlineMarkdown = (text: string, keyPrefix: string): InlineRenderResult => {
  const nodes: React.ReactNode[] = [];
  let containsImage = false;
  let cursor = 0;
  let lastTextIndex = 0;
  let segmentIndex = 0;

  const pushText = (end: number) => {
    if (end <= lastTextIndex) return;
    const segment = text.slice(lastTextIndex, end);
    if (segment.length > 0) {
      nodes.push(
        <span key={`${keyPrefix}-text-${segmentIndex}`}>
          {segment}
        </span>,
      );
      segmentIndex += 1;
    }
    lastTextIndex = end;
  };

  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "`") {
      const end = text.indexOf("`", cursor + 1);
      if (end === -1) {
        cursor += 1;
        continue;
      }
      pushText(cursor);
      const codeContent = text.slice(cursor + 1, end);
      nodes.push(
        <code
          key={`${keyPrefix}-code-${segmentIndex}`}
          className="font-mono px-1 py-0.5 rounded bg-background/50"
        >
          {codeContent}
        </code>,
      );
      segmentIndex += 1;
      cursor = end + 1;
      lastTextIndex = cursor;
      continue;
    }

    if (char === "!" && text[cursor + 1] === "[") {
      const closeBracket = text.indexOf("]", cursor + 2);
      if (closeBracket === -1 || text[closeBracket + 1] !== "(") {
        cursor += 1;
        continue;
      }
      const closeParen = findClosingParen(text, closeBracket + 1);
      if (closeParen === -1) {
        cursor += 1;
        continue;
      }
      const src = text.slice(closeBracket + 2, closeParen).trim();
      pushText(cursor);
      if (src.length > 0) {
        const alt = text.slice(cursor + 2, closeBracket);
        containsImage = true;
        nodes.push(
          <img
            key={`${keyPrefix}-img-${segmentIndex}`}
            src={src}
            alt={alt}
            className="max-w-full h-auto rounded-md shadow-sm mt-2"
          />,
        );
        segmentIndex += 1;
      }
      cursor = closeParen + 1;
      lastTextIndex = cursor;
      continue;
    }

    if (char === "[") {
      const closeBracket = text.indexOf("]", cursor + 1);
      if (closeBracket === -1 || text[closeBracket + 1] !== "(") {
        cursor += 1;
        continue;
      }
      const closeParen = findClosingParen(text, closeBracket + 1);
      if (closeParen === -1) {
        cursor += 1;
        continue;
      }
      const href = text.slice(closeBracket + 2, closeParen).trim();
      pushText(cursor);
      if (href.length > 0) {
        const label = text.slice(cursor + 1, closeBracket);
        nodes.push(
          <a
            key={`${keyPrefix}-link-${segmentIndex}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {label.length > 0 ? label : href}
          </a>,
        );
        segmentIndex += 1;
      }
      cursor = closeParen + 1;
      lastTextIndex = cursor;
      continue;
    }

    cursor += 1;
  }

  pushText(text.length);
  return { nodes, containsImage };
};

interface MarkdownRenderResult {
  elements: React.ReactNode[];
  containsImage: boolean;
}

const tableSeparatorRegex = /^\s*\|?\s*[:\-]{2,}\s*(\|\s*[:\-]{2,}\s*)+\|?\s*$/;

const renderBasicMarkdown = (content: string, keyPrefix: string): MarkdownRenderResult => {
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let containsImage = false;
  let lineIndex = 0;
  let blockIndex = 0;

  const takeIndex = () => {
    const current = blockIndex;
    blockIndex += 1;
    return current;
  };

  const parseTableRow = (raw: string) =>
    raw
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (!line || /^\s*$/.test(line)) {
      lineIndex += 1;
      continue;
    }

    const headingMatch = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const idx = takeIndex();
      const inline = renderInlineMarkdown(text, `${keyPrefix}-heading-${idx}`);
      containsImage ||= inline.containsImage;
      const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
      const headingClass =
        level === 1
          ? "text-base font-bold"
          : level === 2
            ? "text-sm font-semibold"
            : "text-sm font-medium";
      elements.push(
        <HeadingTag key={`${keyPrefix}-heading-${idx}`} className={`mb-2 ${headingClass}`}>
          {inline.nodes}
        </HeadingTag>,
      );
      lineIndex += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const fenceLang = line.replace(/^```/, "").trim();
      lineIndex += 1;
      const codeLines: string[] = [];
      while (lineIndex < lines.length && !/^```/.test(lines[lineIndex])) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }
      if (lineIndex < lines.length) {
        lineIndex += 1;
      }
      const idx = takeIndex();
      elements.push(
        <pre
          key={`${keyPrefix}-codeblock-${idx}`}
          className="p-2 bg-background/50 rounded-md text-xs overflow-x-auto max-h-96"
        >
          <code className={`font-mono${fenceLang ? ` language-${fenceLang}` : ""}`}>
            {codeLines.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      const idx = takeIndex();
      elements.push(<hr key={`${keyPrefix}-rule-${idx}`} className="my-2 border-border" />);
      lineIndex += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const idx = takeIndex();
      const items: React.ReactNode[] = [];
      while (lineIndex < lines.length && /^\s*[-*+]\s+/.test(lines[lineIndex])) {
        const raw = lines[lineIndex].replace(/^\s*[-*+]\s+/, "").trim();
        const itemIndex = items.length;
        const inline = renderInlineMarkdown(raw, `${keyPrefix}-ul-${idx}-${itemIndex}`);
        containsImage ||= inline.containsImage;
        items.push(<li key={`${keyPrefix}-ul-${idx}-${itemIndex}`}>{inline.nodes}</li>);
        lineIndex += 1;
      }
      elements.push(
        <ul key={`${keyPrefix}-ul-${idx}`} className="list-disc space-y-1 pl-5 text-sm">
          {items}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const idx = takeIndex();
      const items: React.ReactNode[] = [];
      while (lineIndex < lines.length && /^\s*\d+\.\s+/.test(lines[lineIndex])) {
        const raw = lines[lineIndex].replace(/^\s*\d+\.\s+/, "").trim();
        const itemIndex = items.length;
        const inline = renderInlineMarkdown(raw, `${keyPrefix}-ol-${idx}-${itemIndex}`);
        containsImage ||= inline.containsImage;
        items.push(<li key={`${keyPrefix}-ol-${idx}-${itemIndex}`}>{inline.nodes}</li>);
        lineIndex += 1;
      }
      elements.push(
        <ol key={`${keyPrefix}-ol-${idx}`} className="list-decimal space-y-1 pl-5 text-sm">
          {items}
        </ol>,
      );
      continue;
    }

    if (line.includes("|") && tableSeparatorRegex.test(lines[lineIndex + 1] ?? "")) {
      const idx = takeIndex();
      const headerCells = parseTableRow(line);
      lineIndex += 2; // skip header and separator
      const rows: string[][] = [];
      while (lineIndex < lines.length) {
        const rowLine = lines[lineIndex];
        if (!rowLine || /^\s*$/.test(rowLine) || !rowLine.includes("|")) {
          break;
        }
        rows.push(parseTableRow(rowLine));
        lineIndex += 1;
      }

      elements.push(
        <div key={`${keyPrefix}-table-${idx}`} className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {headerCells.map((cell, cellIndex) => {
                  const inline = renderInlineMarkdown(cell, `${keyPrefix}-table-${idx}-h-${cellIndex}`);
                  containsImage ||= inline.containsImage;
                  return (
                    <th key={`${keyPrefix}-table-${idx}-h-${cellIndex}`} className="border-b px-2 py-1 text-left font-semibold">
                      {inline.nodes}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${keyPrefix}-table-${idx}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => {
                    const inline = renderInlineMarkdown(cell, `${keyPrefix}-table-${idx}-r-${rowIndex}-${cellIndex}`);
                    containsImage ||= inline.containsImage;
                    return (
                      <td key={`${keyPrefix}-table-${idx}-r-${rowIndex}-${cellIndex}`} className="border-b px-2 py-1 align-top">
                        {inline.nodes}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (lineIndex < lines.length) {
      const paragraphLine = lines[lineIndex];
      if (!paragraphLine || /^\s*$/.test(paragraphLine)) {
        lineIndex += 1;
        break;
      }
      if (/^```/.test(paragraphLine) || /^\s{0,3}(#{1,6})\s+/.test(paragraphLine) || /^\s*[-*+]\s+/.test(paragraphLine) || /^\s*\d+\.\s+/.test(paragraphLine)) {
        break;
      }
      if (paragraphLine.includes("|") && tableSeparatorRegex.test(lines[lineIndex + 1] ?? "")) {
        break;
      }
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(paragraphLine)) {
        break;
      }
      paragraphLines.push(paragraphLine.trim());
      lineIndex += 1;
    }
    const paragraphText = paragraphLines.join(" ").trim();
    if (paragraphText.length > 0) {
      const idx = takeIndex();
      const inline = renderInlineMarkdown(paragraphText, `${keyPrefix}-p-${idx}`);
      containsImage ||= inline.containsImage;
      elements.push(
        <p key={`${keyPrefix}-p-${idx}`} className="mb-2 text-sm last:mb-0">
          {inline.nodes}
        </p>,
      );
    }
  }

  return { elements, containsImage };
};

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

  const renderedMessages = useMemo(
    () =>
      messages.map((message, index) =>
        renderBasicMarkdown(message.content || "", `message-${index}`),
      ),
    [messages],
  );

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const userMessage: Message = { role: "user", content: values.question };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    form.reset();

    try {
      const historyForApi = newMessages.map(({ role, content }) => ({ role, content }));

      const response = await fetch("/api/main-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: values.question,
          history: historyForApi,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const result: MainAssistantOutput = await response.json();

      console.log("[AskAiPanel] Result from mainAssistant:", result);

      const assistantMessage: Message = {
        role: "assistant",
        content: result.answer, // kann Markdown + data:image/png enthalten
        sqlQuery: result.sqlQuery,
        retrievedContext: result.retrievedContext,
        chart: result.chart,
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

            const rendered = renderedMessages[index];

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
                  <div className="text-sm space-y-2">
                    {rendered.elements.length > 0
                      ? rendered.elements
                      : [
                          <p key={`message-${index}-empty`} className="mb-2">
                            {message.content}
                          </p>,
                        ]}
                  </div>

                  {/* ✅ Fallback NUR wenn Markdown KEIN Bild gerendert hat */}
                  {message.role === "assistant" && dataUrl && !rendered.containsImage && (
                    <div className="mt-2">
                      <img
                        src={dataUrl}
                        alt="Chart"
                        className="max-w-full h-auto rounded-md shadow-sm"
                      />
                    </div>
                  )}

                  {message.role === "assistant" && message.chart && (
                    <div className="mt-4 space-y-3">
                      <ChartShell title={message.chart.title} caption={message.chart.caption}>
                        <VegaChart
                          chartId={message.chart.id}
                          request={message.chart.request}
                          initialChart={{
                            id: message.chart.id,
                            config: message.chart.config,
                            title: message.chart.title,
                            caption: message.chart.caption,
                            sqlQuery: message.chart.sqlQuery,
                            retrievedContext: message.chart.retrievedContext,
                          }}
                        />
                      </ChartShell>
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
