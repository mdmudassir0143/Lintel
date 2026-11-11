import './globals.css';
import type { ReactNode } from 'react';
import { Host_Grotesk, Geist_Mono } from 'next/font/google';

const host = Host_Grotesk({ subsets: ['latin'], variable: '--font-host', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata = {
  title: { default: 'Lintel', template: '%s | Lintel' },
  description: 'Lintel finds what stops AI shopping agents at your store, fixes it with one script tag, and settles every agent purchase through PayPal.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${host.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
