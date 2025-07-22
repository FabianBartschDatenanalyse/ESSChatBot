"use client";

import { useState, useEffect } from 'react';
import { MessageSquare, TestTube2, History, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarSeparator } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Logo from '@/components/logo';
import AskAiPanel from '@/components/ask-ai-panel';
import SqlToolPanel from '@/components/sql-tool-panel';
import HistoryPanel from '@/components/history-panel';
import { Button } from './ui/button';

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

  // Effect to create a new conversation if none exist
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
          const newTitle = updatedMessages.length > 0 ? updatedMessages[0].content : 'New Conversation';
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
            <SidebarHeader className='p-4 border-b border-sidebar-border flex justify-between items-center'>
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10 text-primary" />
                <div className="flex flex-col">
                  <h2 className="font-headline text-xl font-semibold">ESS Navigator</h2>
                  <p className="text-xs text-muted-foreground -mt-1">AI Data Explorer</p>
                </div>
              </div>
               <Button variant="outline" size="sm" onClick={handleNewConversation}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New
                </Button>
            </SidebarHeader>
            <SidebarSeparator />
             <SidebarGroup className='p-0'>
                <SidebarGroupLabel className='px-4 pt-2'>
                    <History className='mr-2' />
                    History
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
          <Tabs defaultValue="ai-assistant" className="h-full">
            <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
              <TabsTrigger value="ai-assistant">
                <MessageSquare className="mr-2 h-4 w-4" />
                AI Assistant
              </TabsTrigger>
              <TabsTrigger value="sql-tool">
                <TestTube2 className="mr-2 h-4 w-4" />
                SQL Tool
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ai-assistant" className="mt-4">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="font-headline">Ask the AI</CardTitle>
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
            <TabsContent value="sql-tool" className="mt-4">
               <Card>
                <CardHeader>
                  <CardTitle className="font-headline">SQL Query Tool</CardTitle>
                  <CardDescription>Directly query the ESS dataset or get AI-powered query suggestions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SqlToolPanel />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
