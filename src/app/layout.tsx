import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/src/components/ui/toaster';
import { PT_Sans, Space_Grotesk } from 'next/font/google';

export const metadata: Metadata = {
  title: 'ESS Navigator',
  description: 'Navigate the European Social Survey dataset with AI.',
};

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-pt-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${ptSans.variable} ${spaceGrotesk.variable}`}>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
