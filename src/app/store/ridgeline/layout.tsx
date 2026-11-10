import type { ReactNode } from 'react';
import Link from 'next/link';
import { storeState } from './storeData';
import { CookieWall } from './client';
import { env } from '@/lib/env';
import { MERCHANT_ID } from './storeData';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ridgeline Coffee Roasters — fresh-roasted coffee', description: 'Small-batch coffee roasted every Tuesday.' };

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
        {installed && (
          <span data-paypal="accepted" className="ml-2 rounded bg-[#ffc439] px-2 py-0.5 font-sans font-semibold text-[#003087]">
            Pay with PayPal
          </span>
        )}
      </footer>
      {!installed && <CookieWall />}
      {installed && (
        <>
          {/* Lintel install snippet (what a merchant pastes into their theme) */}
          <script src={`${env.publicBaseUrl}/lintel.js`} data-merchant={MERCHANT_ID} data-base={env.publicBaseUrl} async />
          <link rel="agent-manifest" href={`${env.publicBaseUrl}/m/${MERCHANT_ID}/agent/manifest.json`} />
        </>
      )}
    </div>
  );
}
