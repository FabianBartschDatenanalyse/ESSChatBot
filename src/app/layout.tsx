import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/src/components/ui/toaster';
import localFont from 'next/font/local';

export const metadata: Metadata = {
  title: 'ESS Navigator',
  description: 'Navigate the European Social Survey dataset with AI.',
};

const bodyFont = localFont({
  display: 'swap',
  variable: '--font-body',
  src: [
    { path: '../../public/fonts/DejaVuSans.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/DejaVuSans-Bold.ttf', weight: '700', style: 'normal' },
  ],
});

const headingFont = localFont({
  display: 'swap',
  variable: '--font-heading',
  src: [
    { path: '../../public/fonts/DejaVuSans-Bold.ttf', weight: '700', style: 'normal' },
  ],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
