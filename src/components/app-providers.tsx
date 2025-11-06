'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/src/components/theme-provider';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
