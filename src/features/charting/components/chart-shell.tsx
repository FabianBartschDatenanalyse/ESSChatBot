'use client';

import { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface ChartShellProps {
  title?: string;
  caption?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartShell({
  title,
  caption,
  actions,
  children,
  className,
}: ChartShellProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/5 bg-background/60 shadow-[0_20px_60px_rgba(8,9,37,0.45)] backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold sm:text-base">
            {title ?? 'Automatisch generierte Visualisierung'}
          </p>
          {caption && <p className="text-xs text-muted-foreground sm:text-sm">{caption}</p>}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

