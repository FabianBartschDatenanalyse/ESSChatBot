'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { cn } from '@/src/lib/utils';
import { useChartStore } from '@/src/features/charting/state/chart-store';
import { useChartQuery } from '@/src/features/charting/state/use-chart-query';
import { VisualizationChart, VisualizationRequest } from '@/src/features/charting/types';
import { Button } from '@/src/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Textarea } from '@/src/components/ui/textarea';

type VegaEmbed = typeof import('vega-embed')['default'];
type VegaEmbedResult = Awaited<ReturnType<VegaEmbed>> & {
  openEditor?: (() => void) | undefined;
};

let vegaEmbedPromise: Promise<VegaEmbed> | null = null;
async function loadVegaEmbed(): Promise<VegaEmbed> {
  if (!vegaEmbedPromise) {
    vegaEmbedPromise = import('vega-embed').then((module) => module.default);
  }
  return vegaEmbedPromise;
}

interface VegaChartProps {
  chartId: string;
  request: VisualizationRequest;
  initialChart?: VisualizationChart;
  className?: string;
}

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 420;
const MIN_WIDTH = 320;
const MAX_WIDTH = 1024;

const stringifyForEditor = (value: unknown): string | null => {
  try {
    return JSON.stringify(
      value,
      (_, innerValue) => (typeof innerValue === 'bigint' ? innerValue.toString() : innerValue),
      2,
    );
  } catch {
    return null;
  }
};

function measureAvailableWidth(element: HTMLElement | null): number {
  if (!element) {
    return 0;
  }
  const parentWidth = element.parentElement?.getBoundingClientRect().width ?? 0;
  if (parentWidth > 0) {
    return parentWidth;
  }
  return element.getBoundingClientRect().width;
}

const postSpecToEditor = (editorUrl: string, payload: Record<string, unknown>) => {
  const targetWindow = window.open(editorUrl, '_blank', 'noopener');
  if (!targetWindow) {
    throw new Error('Editor-Fenster konnte nicht geoeffnet werden (Popup blockiert?).');
  }

  const origin = new URL(editorUrl).origin;
  const retryIntervalMs = 250;
  const maxDurationMs = 10_000;
  let remainingAttempts = Math.ceil(maxDurationMs / retryIntervalMs);

  const acknowledge = (event: MessageEvent) => {
    if (event.source === targetWindow) {
      remainingAttempts = 0;
      window.removeEventListener('message', acknowledge);
    }
  };

  window.addEventListener('message', acknowledge);

  const send = () => {
    if (remainingAttempts <= 0) {
      window.removeEventListener('message', acknowledge);
      return;
    }

    targetWindow.postMessage(payload, origin);
    remainingAttempts -= 1;
    window.setTimeout(send, retryIntervalMs);
  };

  window.setTimeout(send, retryIntervalMs);
};

export function VegaChart({ chartId, request, initialChart, className }: VegaChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<VegaEmbedResult | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const isHoveringRef = useRef(false);
  const lastStableSizeRef = useRef<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [editorAvailable, setEditorAvailable] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [specDraft, setSpecDraft] = useState('');
  const [specError, setSpecError] = useState<string | null>(null);

  const query = useChartQuery({ chartId, request, initialChart, enabled: Boolean(chartId && request) });

  const chartEntry = useChartStore((state) => state.items[chartId]);
  const updateChartConfig = useChartStore((state) => state.updateChartConfig);

  const chartConfig = useMemo(() => chartEntry?.chart?.config as VisualizationSpec | undefined, [chartEntry]);

  const buildDownloadFileName = (extension: 'png' | 'svg') => {
    const raw = chartEntry?.chart?.title ?? chartId ?? 'visualisierung';
    const stem = raw
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
    const safeStem = stem.length > 0 ? stem : 'visualisierung';
    return `${safeStem}.${extension}`;
  };

  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveChartAsSvg = async () => {
    const view = viewRef.current?.view;
    if (!view) {
      return;
    }

    try {
      const svg = await view.toSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, buildDownloadFileName('svg'));
      requestAnimationFrame(() => URL.revokeObjectURL(url));
    } catch (error) {
      console.error('SVG Export fehlgeschlagen', error);
    }
  };

  const saveChartAsPng = async () => {
    const view = viewRef.current?.view;
    if (!view) {
      return;
    }

    try {
      const scaleFactor = viewRef.current?.embedOptions?.scaleFactor;
      const pngScale =
        typeof scaleFactor === 'number'
          ? scaleFactor
          : scaleFactor && typeof scaleFactor === 'object'
            ? (scaleFactor as { png?: number }).png
            : undefined;
      const url = await view.toImageURL('png', pngScale);
      triggerDownload(url, buildDownloadFileName('png'));
    } catch (error) {
      console.error('PNG Export fehlgeschlagen', error);
    }
  };

  const viewChartSource = () => {
    const spec = viewRef.current?.spec ?? chartConfig;
    if (!spec) {
      return;
    }

    try {
      const json = JSON.stringify(spec, null, 2);
      const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const win = window.open('', '_blank');
      if (!win) {
        console.warn('Quellansicht konnte nicht geoeffnet werden (Popup blockiert?).');
        return;
      }
      win.document.write(
        `<html><head><title>Vega Source</title></head><body><pre><code class="json">${escaped}</code></pre></body></html>`,
      );
      win.document.close();
    } catch (error) {
      console.error('Quellansicht konnte nicht angezeigt werden', error);
    }
  };

  useEffect(() => {
    if (!chartConfig || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    setEmbeddingError(null);
    setEditorAvailable(false);

    const element = containerRef.current;
    const initialWidth =
      typeof (chartConfig as any)?.width === 'number' ? (chartConfig as any).width : DEFAULT_WIDTH;
    const initialHeight =
      typeof (chartConfig as any)?.height === 'number' ? (chartConfig as any).height : DEFAULT_HEIGHT;
    const aspectRatio =
      initialWidth > 0 && initialHeight > 0 ? initialHeight / initialWidth : DEFAULT_HEIGHT / DEFAULT_WIDTH;

    const tryEmbed = () => {
      if (cancelled || !containerRef.current) {
        return;
      }

      const measuredWidth = measureAvailableWidth(containerRef.current);

      if (measuredWidth <= 0) {
        animationFrameId = requestAnimationFrame(tryEmbed);
        return;
      }

      if (animationFrameId !== null) {
        animationFrameId = null;
      }

      const targetWidth = Math.min(Math.max(measuredWidth, MIN_WIDTH), MAX_WIDTH);
      const targetHeight = Math.round(targetWidth * aspectRatio);
      lastStableSizeRef.current = { width: targetWidth, height: targetHeight };

      const responsiveSpec = JSON.parse(JSON.stringify(chartConfig)) as any;
      responsiveSpec.width = targetWidth;
      responsiveSpec.height = targetHeight;
      responsiveSpec.autosize = { type: 'fit', contains: 'padding', resize: false };

      loadVegaEmbed()
        .then((embed) =>
          embed(element, responsiveSpec, {
            actions: false,
            renderer: 'canvas',
            config: { font: 'var(--font-body)' },
          }),
        )
        .then((result: VegaEmbedResult) => {
          if (cancelled) {
            result.view.finalize();
            return;
          }
          viewRef.current = result;
          setEditorAvailable(true);
        })
        .catch((error: any) => {
          setEmbeddingError(error?.message ?? 'Das Chart konnte nicht angezeigt werden.');
          setEditorAvailable(false);
        });
    };

    tryEmbed();

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (viewRef.current) {
        viewRef.current.view.finalize();
        viewRef.current = null;
      }
      setEditorAvailable(false);
      if (element) {
        element.innerHTML = '';
      }
    };
  }, [chartConfig]);

  useEffect(() => {
    const observerTarget = containerRef.current;

    if (!observerTarget) {
      return;
    }

    const handleResize = () => {
      const view = viewRef.current?.view;
      const config = chartConfig as any;
      if (!view || !observerTarget || !config) {
        return;
      }
      const baseWidth = typeof config.width === 'number' ? config.width : DEFAULT_WIDTH;
      const baseHeight = typeof config.height === 'number' ? config.height : DEFAULT_HEIGHT;
      const ratio =
        baseWidth > 0 && baseHeight > 0 ? baseHeight / baseWidth : DEFAULT_HEIGHT / DEFAULT_WIDTH;
      const containerWidth = measureAvailableWidth(observerTarget) || baseWidth;
      const availableWidth =
        containerWidth > 0 ? Math.min(Math.max(containerWidth, MIN_WIDTH), MAX_WIDTH) : baseWidth;
      const updatedHeight = Math.round(availableWidth * ratio);

      const previousWidth = lastStableSizeRef.current.width;
      const isShrinking = availableWidth < previousWidth;

      if (isHoveringRef.current && isShrinking) {
        return;
      }

      lastStableSizeRef.current = { width: availableWidth, height: updatedHeight };

      view.width(availableWidth).height(updatedHeight).runAsync();
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(observerTarget);
    handleResize();

    // Lock the container to the last stable dimensions while the pointer is inside.
    const lockChartSize = () => {
      if (!observerTarget) {
        return;
      }
      const { width, height } = lastStableSizeRef.current;
      observerTarget.style.setProperty('width', `${width}px`);
      observerTarget.style.setProperty('height', `${height}px`);
      observerTarget.style.setProperty('max-width', '100%');
      const view = viewRef.current?.view;
      if (view) {
        view.width(width).height(height).runAsync();
      }
    };

    // Remove any inline sizing so responsiveness resumes after hovering ends.
    const releaseChartSize = () => {
      if (!observerTarget) {
        return;
      }
      observerTarget.style.removeProperty('width');
      observerTarget.style.removeProperty('height');
      observerTarget.style.removeProperty('max-width');
    };

    const handlePointerEnter = () => {
      isHoveringRef.current = true;
      lockChartSize();
    };
    const handlePointerLeave = () => {
      isHoveringRef.current = false;
      releaseChartSize();
      handleResize();
    };

    observerTarget.addEventListener('pointerenter', handlePointerEnter);
    observerTarget.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      observer.disconnect();
      releaseChartSize();
      observerTarget.removeEventListener('pointerenter', handlePointerEnter);
      observerTarget.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [chartConfig]);

  useEffect(() => {
    if (!isEditDialogOpen || !chartConfig) {
      return;
    }

    const formatted = stringifyForEditor(chartConfig);
    if (formatted) {
      setSpecDraft(formatted);
      setSpecError(null);
    } else {
      setSpecDraft('');
      setSpecError('Die aktuelle Visualisierung konnte nicht serialisiert werden.');
    }
  }, [chartConfig, isEditDialogOpen]);

  useEffect(() => {
    if (!isEditDialogOpen) {
      setSpecError(null);
    }
  }, [isEditDialogOpen]);

  if (embeddingError) {
    return (
      <div className="text-sm text-destructive">
        {embeddingError}
      </div>
    );
  }

  if (chartEntry?.status === 'error') {
    return (
      <div className="text-sm text-destructive">
        {chartEntry.error ?? 'Die Visualisierung ist fehlgeschlagen.'}
      </div>
    );
  }

  if (!chartConfig) {
    return (
      <div className="flex h-48 items-center justify-center">
        <span className="text-sm text-muted-foreground">
          {query.isLoading ? 'Visualisierung wird geladen ...' : 'Noch keine Visualisierung verfuegbar.'}
        </span>
      </div>
    );
  }

  const openEditor = () => {
    const result = viewRef.current;
    const spec = result?.spec ?? chartConfig;
    if (!spec) {
      return;
    }

    const editorUrl =
      typeof result?.embedOptions?.editorUrl === 'string' && result.embedOptions.editorUrl.length > 0
        ? result.embedOptions.editorUrl
        : 'https://vega.github.io/editor/';
    const mode = (result?.embedOptions?.mode as 'vega' | 'vega-lite' | undefined) ?? 'vega-lite';
    const renderer = (result?.embedOptions?.renderer as 'canvas' | 'svg' | undefined) ?? 'canvas';

    try {
      const specString = stringifyForEditor(spec);
      if (!specString) {
        throw new Error('Die Visualisierung konnte nicht serialisiert werden.');
      }

      const payload: Record<string, unknown> = {
        spec: specString,
        mode,
        renderer,
      };

      const configOption = result?.embedOptions?.config;
      if (configOption) {
        if (typeof configOption === 'string') {
          payload.config = configOption;
        } else {
          const configString = stringifyForEditor(configOption);
          if (!configString) {
            console.warn('Die Vega-Konfiguration konnte nicht serialisiert werden und wurde ausgelassen.');
          } else {
            try {
              payload.config = JSON.parse(configString);
            } catch (parseError) {
              console.warn('Die Vega-Konfiguration konnte nicht verarbeitet werden und wurde ausgelassen.', parseError);
            }
          }
        }
      }

      postSpecToEditor(editorUrl, payload);
    } catch (error) {
      console.error('Vega Editor konnte nicht geoeffnet werden', error);
    }
  };

  const handleSaveSpec = () => {
    if (!chartConfig) {
      return;
    }

    try {
      const parsed = JSON.parse(specDraft);
      setSpecError(null);
      updateChartConfig(chartId, parsed);
      setIsEditDialogOpen(false);
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : 'Die Spezifikation konnte nicht verarbeitet werden.';
      setSpecError(message);
    }
  };

  const showEditControls = Boolean(chartConfig);

  return (
    <div className={cn('relative w-full', className)}>
      {showEditControls && (
        <div className="absolute left-2 top-2 z-10 flex flex-wrap justify-start gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                aria-label="Diagrammaktionen"
              >
                <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem disabled={!editorAvailable} onSelect={() => { void saveChartAsSvg(); }}>
                Save as SVG
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!editorAvailable} onSelect={() => { void saveChartAsPng(); }}>
                Save as PNG
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!editorAvailable} onSelect={viewChartSource}>
                View Source
              </DropdownMenuItem>
              {editorAvailable && (
                <DropdownMenuItem onSelect={openEditor}>
                  Im Vega Editor oeffnen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                Spezifikation anpassen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div ref={containerRef} className="w-full" />
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualisierung bearbeiten</DialogTitle>
            <DialogDescription>
              Passe die Vega-Lite-Spezifikation an. Aenderungen werden nach dem Speichern in der Ansicht uebernommen.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={specDraft}
            onChange={(event) => setSpecDraft(event.target.value)}
            className="min-h-[320px] font-mono text-xs"
          />
          {specError && <p className="text-sm text-destructive">{specError}</p>}
          <DialogFooter className="gap-2">
            {editorAvailable && (
              <Button variant="outline" onClick={openEditor}>
                Im Vega Editor oeffnen
              </Button>
            )}
            <Button onClick={handleSaveSpec}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
