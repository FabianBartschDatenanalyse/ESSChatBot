"use client";

import { useState, useEffect, useRef } from 'react';
import { History, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message } from '@/lib/types';

import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarSeparator } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Logo from '@/components/logo';
import AskAiPanel from '@/components/ask-ai-panel';
import HistoryPanel from '@/components/history-panel';
import { Button } from './ui/button';

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const isInitialMount = useRef(true);


  useEffect(() => {
    // On initial load, create a new conversation if none exist.
    // The isInitialMount ref prevents this from running twice in React's Strict Mode (dev).
    if (isInitialMount.current && conversations.length === 0) {
      handleNewConversation();
    }
    isInitialMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);
  
  const handleNewConversation = () => {
    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      title: 'New Conversation',
      messages: [{
        role: 'assistant',
        content: "Hello! I'm the ESS Navigator assistant. Ask me anything about the European Social Survey dataset."
      }],
    };
    setConversations(prev => [...prev, newConversation]);
    setActiveConversationId(newId);
  };

  const updateConversation = (conversationId: string, updatedMessages: Message[]) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          // Update title based on the first user message, if it exists
          const firstUserMessage = updatedMessages.find(m => m.role === 'user');
          const newTitle = firstUserMessage 
            ? firstUserMessage.content.substring(0, 40) + (firstUserMessage.content.length > 40 ? '...' : '') 
            : conv.title;
          return { ...conv, messages: updatedMessages, title: newTitle };
        }
        return conv;
      })
    );
  };
  
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent className="p-0 flex flex-col">
            <SidebarHeader className='p-4 border-b border-sidebar-border'>
              <div className="flex items-center gap-3">
                <Logo className="h-10" />
                <div className="flex flex-col">
                  <h2 className="font-headline text-lg font-semibold">ESS Navigator</h2>
                  <p className="text-xs text-muted-foreground -mt-1">AI Data Explorer</p>
                </div>
              </div>
            </SidebarHeader>
            <SidebarSeparator />
             <SidebarGroup className='p-0'>
                <SidebarGroupLabel className='px-4 pt-2 flex justify-between items-center'>
                    <div className='flex items-center gap-2'>
                        <History className='h-4 w-4' />
                        History
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleNewConversation}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New
                    </Button>
                </SidebarGroupLabel>
                <div className="p-4">
                  <HistoryPanel 
                    conversations={conversations} 
                    activeConversationId={activeConversationId}
                    setActiveConversationId={setActiveConversationId}
                  />
                </div>
            </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="font-headline">AI Assistant</CardTitle>
                <CardDescription>Get answers about the ESS dataset from our intelligent assistant.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {activeConversation ? (
                <AskAiPanel
                  key={activeConversation.id}
                  conversation={activeConversation}
                  onMessagesUpdate={updateConversation}
                />
              ) : (
                  <div className="flex h-[65vh] flex-col items-center justify-center">
                    <p className="text-muted-foreground">Select a conversation or start a new one.</p>
                  </div>
              )}
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
