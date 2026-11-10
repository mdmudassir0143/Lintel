import './globals.css';
import type { ReactNode } from 'react';
import { Archivo } from 'next/font/google';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

export const metadata = {
  title: 'Lintel — make your store buyable by AI agents',
  description: 'Scan your store, see why AI shopping agents fail, fix it, and get paid through PayPal.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
