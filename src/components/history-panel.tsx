
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "./ui/scroll-area";
import { Code2, Database } from "lucide-react";

export interface HistoryItem {
  question: string;
  answer: string;
  sqlQuery?: string;
  retrievedContext?: string;
}

interface HistoryPanelProps {
  history: HistoryItem[];
}

export default function HistoryPanel({ history }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No history yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[60vh] w-full">
        <Accordion type="single" collapsible className="w-full">
        {history.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left hover:no-underline">
                <p className="truncate font-medium text-sm">{item.question}</p>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
                {item.sqlQuery && (
                <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        <Code2 className="h-4 w-4" />
                        SQL Query
                    </h4>
                    <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto">
                        <code className="font-mono">{item.sqlQuery}</code>
                    </pre>
                </div>
                )}
                {item.retrievedContext && (
                 <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        <Database className="h-4 w-4" />
                        Retrieved Context
                    </h4>
                    <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                        <code className="font-sans">{item.retrievedContext}</code>
                    </pre>
                </div>
                )}
            </AccordionContent>
            </AccordionItem>
        ))}
        </Accordion>
    </ScrollArea>
  );
}
