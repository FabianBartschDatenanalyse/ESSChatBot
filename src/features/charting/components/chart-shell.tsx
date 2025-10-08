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
    <div className={cn('rounded-lg border bg-background shadow-sm', className)}>
      <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-sm sm:text-base">
            {title ?? 'Automatisch generierte Visualisierung'}
          </p>
          {caption && <p className="text-xs text-muted-foreground sm:text-sm">{caption}</p>}
        </div>
        {actions}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

