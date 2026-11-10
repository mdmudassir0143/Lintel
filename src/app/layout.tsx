import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Lintel — make your store buyable by AI agents',
  description: 'Scan your store, fix what blocks AI shoppers, and get paid through PayPal.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
