"use client";

import React from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/src/components/ui/chart';
import { CartesianGrid, XAxis, YAxis, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
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

function buildChartConfig(chart: ChartDefinition) {
  return chart.series.reduce<Record<string, { label?: React.ReactNode; color?: string }>>(
    (acc, series, index) => {
      acc[series.key] = {
        label: series.label ?? humanize(series.key),
        color: chartPalette[index % chartPalette.length],
      };
      return acc;
    },
    {},
  );
}

function normalizeData(chart: ChartDefinition) {
  return chart.data.map((row) => {
    const normalized: Record<string, unknown> = { ...row };
    chart.series.forEach((series) => {
      const value = (row as Record<string, unknown>)[series.key];
      if (typeof value === 'string') {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) {
          normalized[series.key] = numeric;
        }
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
  const config = React.useMemo(() => buildChartConfig(chart), [chart]);
  const data = React.useMemo(() => normalizeData(chart), [chart]);

  const renderCartesian = (type: 'bar' | 'line' | 'area') => {
    const commonAxes = (
      <>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip cursor={{ opacity: 0.2 }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
      </>
    );

    if (type === 'bar') {
      return (
        <BarChart data={data}>
          {commonAxes}
          {chart.series.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              fill={`var(--color-${series.key})`}
              radius={4}
              maxBarSize={64}
            />
          ))}
        </BarChart>
      );
    }

    if (type === 'line') {
      return (
        <LineChart data={data}>
          {commonAxes}
          {chart.series.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              stroke={`var(--color-${series.key})`}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      );
    }

    return (
      <AreaChart data={data}>
        {commonAxes}
        {chart.series.map((series) => (
          <Area
            key={series.key}
            type="monotone"
            dataKey={series.key}
            fill={`var(--color-${series.key})`}
            stroke={`var(--color-${series.key})`}
            fillOpacity={0.3}
          />
        ))}
      </AreaChart>
    );
  };

  const renderPie = () => {
    const [series] = chart.series;
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
              fill={chartPalette[index % chartPalette.length]}
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
