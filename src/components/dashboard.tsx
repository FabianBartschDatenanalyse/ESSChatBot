"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  History,
  PlusCircle,
  RotateCcw,
  SquareArrowOutUpRight,
  AlertCircle,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message } from '@/src/lib/types';

import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/src/components/ui/sidebar';
import { Card, CardContent } from '@/src/components/ui/card';
import Logo from '@/src/components/logo';
import AskAiPanel from '@/src/components/ask-ai-panel';
import HistoryPanel from '@/src/components/history-panel';
import { Button } from '@/src/components/ui/button';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { fetchDatasets } from '@/src/features/datasets/api';
import type { DatasetSummary } from '@/src/features/datasets/types';
import { useTheme } from '@/src/components/theme-provider';

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const { theme, toggleTheme, isReady: isThemeReady } = useTheme();

  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    setDatasetsError(null);
    try {
      const list = await fetchDatasets();
      setDatasets(list);
      const validIds = new Set(list.map((item) => item.id));
      setConversations((prev) =>
        prev.map((conv) =>
          conv.datasetId && !validIds.has(conv.datasetId) ? { ...conv, datasetId: null } : conv,
        ),
      );
      setActiveDatasetId((prev) => {
        if (prev && validIds.has(prev)) {
          return prev;
        }
        return list.length > 0 ? list[0].id : null;
      });
    } catch (error: any) {
      setDatasetsError(error?.message ?? 'Failed to load datasets.');
    } finally {
      setDatasetsLoading(false);
    }
  }, [setConversations]);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    if (!activeDatasetId && datasets.length > 0) {
      setActiveDatasetId(datasets[0].id);
    }
  }, [datasets, activeDatasetId]);

  const activeDataset = useMemo(
    () => (activeDatasetId ? datasets.find((item) => item.id === activeDatasetId) ?? null : null),
    [activeDatasetId, datasets],
  );
  const datasetMetrics = useMemo(() => {
    const readyDatasets = datasets.filter((dataset) =>
      ['ready', 'processed', 'available', 'completed', 'active'].includes(dataset.status),
    ).length;
    return {
      totalDatasets: datasets.length,
      readyDatasets,
      conversations: conversations.length,
    };
  }, [datasets, conversations.length]);

  useEffect(() => {
    if (!activeConversationId || !activeDatasetId) {
      return;
    }
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId && !conv.datasetId ? { ...conv, datasetId: activeDatasetId } : conv,
      ),
    );
  }, [activeConversationId, activeDatasetId]);

  useEffect(() => {
    if (isInitialMount.current && conversations.length === 0) {
      handleNewConversation();
    }
    isInitialMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  const handleOpenManageDatasetsWindow = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = `${window.location.origin}/datasets/manage`;
    window.open(url, '_blank', 'noopener,noreferrer,width=1280,height=900');
  };

  const handleNewConversation = () => {
    const newId = uuidv4();
    const datasetTitle = activeDatasetId
      ? datasets.find((dataset) => dataset.id === activeDatasetId)?.title ?? 'your dataset'
      : null;
    const newConversation: Conversation = {
      id: newId,
      title: 'New Conversation',
      datasetId: activeDatasetId,
      messages: [
        {
          role: 'assistant',
          content: datasetTitle
            ? `Willkommen bei SocialAnalysis! Frage mich alles zu "${datasetTitle}" und erhalte kuratierte Einsichten.`
            : 'Willkommen bei SocialAnalysis! Lade ein Dataset hoch oder waehle eines aus, um mit der Exploration zu starten.',
        },
      ],
    };
    setConversations((prev) => [...prev, newConversation]);
    setActiveConversationId(newId);
  };

  const updateConversation = (conversationId: string, updatedMessages: Message[]) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === conversationId) {
          const firstUserMessage = updatedMessages.find((m) => m.role === 'user');
          const newTitle =
            firstUserMessage && firstUserMessage.content.length > 0
              ? firstUserMessage.content.substring(0, 40) +
                (firstUserMessage.content.length > 40 ? '...' : '')
              : conv.title;
          return { ...conv, messages: updatedMessages, title: newTitle };
        }
        return conv;
      }),
    );
  };

  const updateConversationDataset = (conversationId: string, datasetId: string | null) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === conversationId ? { ...conv, datasetId } : conv)),
    );
    if (conversationId === activeConversationId) {
      setActiveDatasetId(datasetId);
    }
  };

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent className="flex h-full flex-col overflow-y-auto bg-sidebar/80 p-0 text-sidebar-foreground backdrop-blur">
          <SidebarHeader className="border-b border-white/10 px-5 pb-4 pt-5">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" aria-label="Zur Landingpage" className="inline-flex">
                <Logo className="h-12 transition-opacity hover:opacity-80" />
              </Link>
              <Sparkles className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-white/[0.04] px-3 py-2 text-[0.65rem] uppercase tracking-wide text-sidebar-foreground/60">
              <div className="flex flex-1 flex-col leading-tight">
                <span>Datasets</span>
                <span className="text-lg font-semibold text-sidebar-foreground">
                  {datasetMetrics.totalDatasets}
                </span>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div className="flex flex-1 flex-col leading-tight">
                <span>Bereit</span>
                <span className="text-lg font-semibold text-sidebar-foreground">
                  {datasetMetrics.readyDatasets}
                </span>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div className="flex flex-1 flex-col leading-tight">
                <span>Sessions</span>
                <span className="text-lg font-semibold text-sidebar-foreground">
                  {datasetMetrics.conversations}
                </span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarSeparator className="border-sidebar-border/30" />
          <SidebarGroup className="flex-1 overflow-y-auto p-0">
            <SidebarGroupLabel className="flex items-center justify-between px-5 py-4 text-sm font-medium text-sidebar-foreground">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Konversationen
              </span>
              <Button variant="ghost" size="sm" onClick={handleNewConversation}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Neue Analyse
              </Button>
            </SidebarGroupLabel>
            <div className="px-5 pb-6">
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
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur-lg sm:px-8">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void loadDatasets()} disabled={datasetsLoading}>
              <RotateCcw className={datasetsLoading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Aktualisieren
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleTheme} disabled={!isThemeReady}>
              {theme === 'dark' ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              {theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus'}
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-8">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-foreground">SocialAnalysis Copilot</h1>
                {activeDataset ? (
                  <p className="text-sm text-muted-foreground">
                    Aktives Dataset:{' '}
                    <span className="font-medium text-foreground">{activeDataset.title}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Kein Dataset verbunden. Lade Daten hoch oder verwalte sie, um loszulegen.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleOpenManageDatasetsWindow}>
                  <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                  Datensatz-Verwaltung
                </Button>
                <Button onClick={handleNewConversation}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Neue Session
                </Button>
              </div>
            </div>
            {datasetsError ? (
              <Alert variant="destructive" className="max-w-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{datasetsError}</AlertDescription>
              </Alert>
            ) : null}
            <Card className="flex min-h-[60vh] flex-col border-none bg-background/60">
              <CardContent className="flex flex-1 flex-col p-0">
                {activeConversation ? (
                  <AskAiPanel
                    key={activeConversation.id}
                    conversation={activeConversation}
                    onMessagesUpdate={updateConversation}
                    onDatasetChange={updateConversationDataset}
                    datasets={datasets}
                    isDatasetsLoading={datasetsLoading}
                    datasetError={datasetsError ?? undefined}
                  />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Starte eine neue SocialAnalysis Session, um Insights freizuschalten.
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        Waehle ein Dataset oder beginne direkt mit einer neuen Konversation.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

