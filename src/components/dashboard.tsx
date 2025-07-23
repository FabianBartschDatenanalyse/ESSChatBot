"use client";

import { useState, useEffect } from 'react';
import { History, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarSeparator } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Logo from '@/components/logo';
import AskAiPanel from '@/components/ask-ai-panel';
import HistoryPanel from '@/components/history-panel';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import SqlToolPanel from './sql-tool-panel';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  sqlQuery?: string;
  retrievedContext?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (conversations.length === 0) {
      handleNewConversation();
    }
  }, [conversations.length]);
  
  const handleNewConversation = () => {
    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      title: 'New Conversation',
      messages: [],
    };
    setConversations(prev => [...prev, newConversation]);
    setActiveConversationId(newId);
  };

  const updateConversation = (conversationId: string, updatedMessages: Message[]) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          const newTitle = updatedMessages.length > 0 ? updatedMessages[0].content.substring(0, 40) + '...' : 'New Conversation';
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
                    <div className='flex items-center'>
                        <History className='mr-2' />
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
          <Tabs defaultValue="assistant" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
              <TabsTrigger value="sql">SQL Tool</TabsTrigger>
            </TabsList>
            <TabsContent value="assistant">
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
            </TabsContent>
            <TabsContent value="sql">
              <SqlToolPanel />
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
