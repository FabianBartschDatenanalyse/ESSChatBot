"use client";

import React from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/src/components/ui/chart';
import {
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Label,
} from 'recharts';
import type { ChartDefinition } from '@/src/lib/types';
import { cn } from '@/src/lib/utils';

const chartPalette = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function humanize(label: string): string {
  return label
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/g, (char) => char.toUpperCase());
}

type ResolvedSeries = ChartDefinition['series'][number] & {
  color: string;
  dataKey: string;
};

function resolveSeries(chart: ChartDefinition): ResolvedSeries[] {
  return chart.series.map((series, index) => ({
    ...series,
    color: series.color ?? chartPalette[index % chartPalette.length],
    dataKey: series.dataKey ?? series.key,
  }));
}

function buildChartConfig(series: ResolvedSeries[]) {
  return series.reduce<Record<string, { label?: React.ReactNode; color?: string }>>(
    (acc, series, index) => {
      acc[series.key] = {
        label: series.label ?? humanize(series.key),
        color: series.color ?? chartPalette[index % chartPalette.length],
      };
      return acc;
    },
    {},
  );
}

function getValue(row: Record<string, unknown>, key: string) {
  if (key in row) {
    return row[key];
  }

  if (key.includes('.')) {
    return key.split('.').reduce<unknown>((acc, segment) => {
      if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[segment];
      }
      return undefined;
    }, row);
  }

  return undefined;
}

function coerceNumeric(value: unknown) {
  if (typeof value === 'number' || value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }

    const normalized = trimmed.replace(/[^0-9+\-Ee.]/g, '');
    if (normalized && !Number.isNaN(Number(normalized))) {
      return Number(normalized);
    }
  }

  return value;
}

function normalizeData(chart: ChartDefinition, series: ResolvedSeries[]) {
  return chart.data.map((row) => {
    const normalized: Record<string, unknown> = { ...row };
    series.forEach((series) => {
      const sourceValue = getValue(row as Record<string, unknown>, series.dataKey);
      const numeric = coerceNumeric(sourceValue);
      if (numeric !== undefined) {
        normalized[series.key] = numeric;
      }
    });
    return normalized;
  });
}

interface ChatVisualizationProps {
  chart: ChartDefinition;
  className?: string;
}

export function ChatVisualization({ chart, className }: ChatVisualizationProps) {
  const resolvedSeries = React.useMemo(() => resolveSeries(chart), [chart]);
  const config = React.useMemo(() => buildChartConfig(resolvedSeries), [resolvedSeries]);
  const data = React.useMemo(() => normalizeData(chart, resolvedSeries), [chart, resolvedSeries]);
  const hasSecondaryAxis = React.useMemo(
    () => resolvedSeries.some((series) => series.axis === 'right'),
    [resolvedSeries],
  );

  const renderCartesian = (type: 'bar' | 'line' | 'area') => {
    const commonAxes = (
      <>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false}>
          {chart.xLabel && (
            <Label value={chart.xLabel} position="insideBottom" offset={-12} className="text-xs" />
          )}
        </XAxis>
        <YAxis tickLine={false} axisLine={false} width={48} yAxisId="left">
          {chart.yLabel && (
            <Label
              value={chart.yLabel}
              position="insideLeft"
              angle={-90}
              offset={12}
              className="text-xs"
            />
          )}
        </YAxis>
        {hasSecondaryAxis && (
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            orientation="right"
            yAxisId="right"
          >
            {chart.yLabelSecondary && (
              <Label
                value={chart.yLabelSecondary}
                position="insideRight"
                angle={90}
                offset={12}
                className="text-xs"
              />
            )}
          </YAxis>
        )}
        <ChartTooltip cursor={{ opacity: 0.2 }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
      </>
    );

    if (type === 'bar') {
      return (
        <BarChart data={data}>
          {commonAxes}
          {resolvedSeries.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              fill={series.color}
              stroke={series.color}
              radius={4}
              maxBarSize={64}
              stackId={series.stackId}
              yAxisId={series.axis === 'right' ? 'right' : 'left'}
            />
          ))}
        </BarChart>
      );
    }

    if (type === 'line') {
      return (
        <LineChart data={data}>
          {commonAxes}
          {resolvedSeries.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              stroke={series.color}
              strokeWidth={2}
              dot={false}
              yAxisId={series.axis === 'right' ? 'right' : 'left'}
            />
          ))}
        </LineChart>
      );
    }

    return (
      <AreaChart data={data}>
        {commonAxes}
        {resolvedSeries.map((series) => (
          <Area
            key={series.key}
            type="monotone"
            dataKey={series.key}
            fill={series.color}
            stroke={series.color}
            fillOpacity={0.3}
            stackId={series.stackId}
            yAxisId={series.axis === 'right' ? 'right' : 'left'}
          />
        ))}
      </AreaChart>
    );
  };

  const renderPie = () => {
    const [series] = resolvedSeries;
    return (
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Pie
          data={data}
          dataKey={series.key}
          nameKey={chart.xKey}
          innerRadius={40}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={series.color ?? chartPalette[index % chartPalette.length]}
              stroke="var(--border)"
            />
          ))}
        </Pie>
      </PieChart>
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      {(chart.title || chart.description) && (
        <div className="space-y-1 text-left">
          {chart.title && <h4 className="font-semibold text-sm leading-tight">{chart.title}</h4>}
          {chart.description && (
            <p className="text-xs text-muted-foreground leading-snug">{chart.description}</p>
          )}
        </div>
      )}
      <ChartContainer config={config} className="w-full">
        {chart.type === 'pie' ? renderPie() : renderCartesian(chart.type)}
      </ChartContainer>
    </div>
  );
}
