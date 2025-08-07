"use client";

import { ScrollArea } from "@/src/components/ui/scroll-area";
import type { Conversation } from '@/src/components/dashboard';
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

interface HistoryPanelProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string) => void;
}

export default function HistoryPanel({ conversations, activeConversationId, setActiveConversationId }: HistoryPanelProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No history yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-150px)] w-full">
      <div className="flex flex-col gap-2 pr-2">
        {conversations.map((conv) => (
          <Button
            key={conv.id}
            variant="ghost"
            className={cn(
              "w-full justify-start text-left h-auto whitespace-normal",
              conv.id === activeConversationId && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
            onClick={() => setActiveConversationId(conv.id)}
          >
           <p className="truncate text-sm font-medium">{conv.title}</p>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
