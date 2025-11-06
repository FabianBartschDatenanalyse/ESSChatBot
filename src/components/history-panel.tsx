"use client";

import { ScrollArea } from "@/src/components/ui/scroll-area";
import type { Conversation } from '@/src/lib/types';
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
    <ScrollArea className="h-[calc(100vh-220px)] w-full pr-1">
      <div className="flex flex-col gap-3">
        {conversations.map((conv) => (
          <Button
            key={conv.id}
            variant="ghost"
            className={cn(
              'h-auto w-full justify-start gap-3 rounded-lg border border-transparent px-3 py-3 text-left text-sm font-medium text-sidebar-foreground/90 transition-colors hover:border-white/10 hover:bg-white/5',
              conv.id === activeConversationId &&
                'border-sidebar-accent bg-sidebar-accent text-sidebar-accent-foreground shadow-sm',
            )}
            onClick={() => setActiveConversationId(conv.id)}
          >
            <p className="text-sm font-medium leading-snug">{conv.title}</p>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
