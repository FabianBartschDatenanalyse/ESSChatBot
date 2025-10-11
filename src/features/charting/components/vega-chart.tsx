'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import vegaEmbed, { VisualizationSpec } from 'vega-embed';
import { cn } from '@/src/lib/utils';
import { useChartStore } from '@/src/features/charting/state/chart-store';
import { useChartQuery } from '@/src/features/charting/state/use-chart-query';
import { VisualizationChart, VisualizationRequest } from '@/src/features/charting/types';

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

export function VegaChart({ chartId, request, initialChart, className }: VegaChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  type VegaEmbedResult = Awaited<ReturnType<typeof vegaEmbed>>;
  const viewRef = useRef<VegaEmbedResult | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  const query = useChartQuery({ chartId, request, initialChart, enabled: Boolean(chartId && request) });

  const chartEntry = useChartStore((state) => state.items[chartId]);

  const chartConfig = useMemo(() => chartEntry?.chart?.config as VisualizationSpec | undefined, [chartEntry]);

  useEffect(() => {
    if (!chartConfig || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    setEmbeddingError(null);

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

      const measuredWidth = containerRef.current.getBoundingClientRect().width;

      if (measuredWidth <= 0) {
        animationFrameId = requestAnimationFrame(tryEmbed);
        return;
      }

      if (animationFrameId !== null) {
        animationFrameId = null;
      }

      const targetWidth = Math.min(Math.max(measuredWidth, MIN_WIDTH), MAX_WIDTH);
      const targetHeight = Math.round(targetWidth * aspectRatio);

      const responsiveSpec = JSON.parse(JSON.stringify(chartConfig)) as any;
      responsiveSpec.width = targetWidth;
      responsiveSpec.height = targetHeight;
      responsiveSpec.autosize = { type: 'fit', contains: 'padding', resize: true };

      vegaEmbed(containerRef.current, responsiveSpec, {
        actions: false,
        renderer: 'canvas',
        config: { font: 'var(--font-body)' },
      })
        .then((result) => {
          if (cancelled) {
            result.view.finalize();
            return;
          }
          viewRef.current = result;
        })
        .catch((error: any) => {
          setEmbeddingError(error?.message ?? 'Das Chart konnte nicht angezeigt werden.');
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
      const containerWidth = observerTarget.getBoundingClientRect().width || baseWidth;
      const availableWidth =
        containerWidth > 0 ? Math.min(Math.max(containerWidth, MIN_WIDTH), MAX_WIDTH) : baseWidth;
      const updatedHeight = Math.round(availableWidth * ratio);

      view.width(availableWidth).height(updatedHeight).runAsync();
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(observerTarget);
    handleResize();

    return () => {
      observer.disconnect();
    };
  }, [chartConfig]);

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

  return <div ref={containerRef} className={cn('relative w-full', className)} />;
}
