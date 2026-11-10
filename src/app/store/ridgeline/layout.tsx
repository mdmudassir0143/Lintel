import type { ReactNode } from 'react';
import Link from 'next/link';
import { storeState } from './storeData';
import { CookieWall } from './client';

export const dynamic = 'force-dynamic';

export default function StoreLayout({ children }: { children: ReactNode }) {
  const { installed, name } = storeState();
  return (
    <div className="min-h-screen bg-[#f6f1ea] text-[#2b2118]" style={{ fontFamily: 'Georgia, serif' }}>
      <header className="border-b border-[#e3d8ca] bg-[#2b2118] text-[#f6f1ea]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/store/ridgeline" className="text-xl tracking-wide">☕ {name}</Link>
          <nav className="flex gap-5 text-sm">
            <Link href="/store/ridgeline">Shop</Link>
            <Link href="/store/ridgeline/checkout">Cart</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-[#8a7a68]">
        Small-batch roasting since 2014 · Demo store for Lintel
      </footer>
      {!installed && <CookieWall />}
    </div>
  );
}
