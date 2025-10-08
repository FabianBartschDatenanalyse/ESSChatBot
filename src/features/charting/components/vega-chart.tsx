'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import vegaEmbed, { VisualizationSpec } from 'vega-embed';
import { useChartStore } from '@/src/features/charting/state/chart-store';
import { useChartQuery } from '@/src/features/charting/state/use-chart-query';
import { VisualizationChart, VisualizationRequest } from '@/src/features/charting/types';

interface VegaChartProps {
  chartId: string;
  request: VisualizationRequest;
  initialChart?: VisualizationChart;
  className?: string;
}

export function VegaChart({ chartId, request, initialChart, className }: VegaChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<vegaEmbed.Result | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  const query = useChartQuery({ chartId, request, initialChart, enabled: Boolean(chartId && request) });

  const chartEntry = useChartStore((state) => state.items[chartId]);

  const chartConfig = useMemo(() => chartEntry?.chart?.config as VisualizationSpec | undefined, [chartEntry]);

  useEffect(() => {
    if (!chartConfig || !containerRef.current) {
      return;
    }

    let cancelled = false;
    setEmbeddingError(null);

    const element = containerRef.current;

    vegaEmbed(element, chartConfig, {
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

    return () => {
      cancelled = true;
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
    const view = viewRef.current?.view;
    const element = containerRef.current;

    if (!view || !element) {
      return;
    }

    const observer = new ResizeObserver(() => {
      view.resize().runAsync();
    });

    observer.observe(element);

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
          {query.isLoading ? 'Visualisierung wird geladen …' : 'Noch keine Visualisierung verfügbar.'}
        </span>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}

