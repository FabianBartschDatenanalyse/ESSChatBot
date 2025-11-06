import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/src/components/ui/toaster';
import { AppProviders } from '@/src/components/app-providers';
import { Inter, Space_Grotesk } from 'next/font/google';

export const metadata: Metadata = {
  title: {
    default: 'SocialAnalysis',
    template: '%s | SocialAnalysis',
  },
  description: 'SocialAnalysis ist das moderne Analytics-Studio fuer soziale Daten und KI-gestuetzte Insights.',
};

const bodyFont = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body className="font-body antialiased bg-background text-foreground selection:bg-primary/20 selection:text-primary-foreground">
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
