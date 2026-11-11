import type { ReactNode } from 'react';

export const metadata = { title: 'Dashboard' };

export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
