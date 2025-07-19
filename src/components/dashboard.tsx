"use client";

import { Database, MessageSquare, TestTube2 } from 'lucide-react';

import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Logo from '@/components/logo';
import CodebookViewer from '@/components/codebook-viewer';
import AskAiPanel from '@/components/ask-ai-panel';
import SqlToolPanel from '@/components/sql-tool-panel';


export default function Dashboard() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent className="p-0">
            <SidebarHeader className='p-4 border-b border-sidebar-border'>
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10 text-primary" />
                <div className="flex flex-col">
                  <h2 className="font-headline text-xl font-semibold">ESS Navigator</h2>
                  <p className="text-xs text-muted-foreground -mt-1">AI Data Explorer</p>
                </div>
              </div>
            </SidebarHeader>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Codebook
              </SidebarGroupLabel>
              <CodebookViewer />
            </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          <SidebarTrigger />
          {/* UserNav removed as user is not available */}
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
                  <CardTitle className="font-headline">Ask the AI</CardTitle>
                  <CardDescription>Get answers about the ESS dataset from our intelligent assistant.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AskAiPanel />
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
