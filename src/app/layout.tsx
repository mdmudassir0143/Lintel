import './globals.css';
import type { ReactNode } from 'react';
import { Archivo } from 'next/font/google';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

export const metadata = {
  title: { default: 'Lintel', template: '%s | Lintel' },
  description: 'Lintel finds what stops AI shopping agents at your store, fixes it with one script tag, and settles every agent purchase through PayPal.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
