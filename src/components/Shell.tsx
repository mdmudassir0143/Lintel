import Link from 'next/link';
import type { ReactNode } from 'react';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/" className="wide text-xl font-extrabold tracking-tight">lintel</Link>
        <nav className="flex gap-6 text-sm text-ink/70">
          <Link href="/merchant/ridgeline" className="hover:text-ink">Demo merchant</Link>
          <Link href="/store/ridgeline" className="hover:text-ink">Demo store</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-24">{children}</main>
    </div>
  );
}
