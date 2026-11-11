import type { ReactNode } from 'react';
import Link from 'next/link';
import { Fraunces, Work_Sans } from 'next/font/google';
import { storeState, MERCHANT_ID } from './storeData';
import { CookieWall, CartLink } from './client';
import { Mark, R } from './ui';
import { env } from '@/lib/env';

const display = Fraunces({ subsets: ['latin'], variable: '--rl-display', display: 'swap' });
const body = Work_Sans({ subsets: ['latin'], variable: '--rl-body', display: 'swap' });

export const dynamic = 'force-dynamic';
export const metadata = { title: { absolute: 'Ridgeline Coffee Roasters — fresh-roasted coffee' }, description: 'Small-batch coffee roasted every Tuesday.' };

export default function StoreLayout({ children }: { children: ReactNode }) {
  const { installed, name } = storeState();
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen`} style={{ background: R.oat, color: R.ink, fontFamily: 'var(--rl-body), system-ui, sans-serif' }}>
      <div className="px-4 py-2 text-center text-[13px] tracking-wide" style={{ background: R.pine, color: R.oat }}>
        Roasted every Tuesday, shipped the next morning. Free shipping on two bags or more.
      </div>
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ borderColor: R.line, background: 'rgba(247,243,236,.92)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <nav className="hidden gap-7 text-[15px] md:flex">
            <Link href="/store/ridgeline#coffee" className="hover:opacity-70">Coffee</Link>
            <Link href="/store/ridgeline#gear" className="hover:opacity-70">Brew gear</Link>
            <Link href="/store/ridgeline#story" className="hover:opacity-70">Our roastery</Link>
          </nav>
          <Link href="/store/ridgeline" className="flex items-center gap-2.5">
            <Mark className="h-7 w-7" />
            <span className="text-[20px] tracking-tight" style={{ fontFamily: 'var(--rl-display), Georgia, serif' }}>{name}</span>
          </Link>
          <div className="flex items-center gap-5 text-[15px]">
            <Link href="/store/ridgeline#coffee" className="hidden hover:opacity-70 sm:inline">Shop</Link>
            <CartLink />
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-24" style={{ background: R.pine, color: R.oat }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2.5"><Mark className="h-7 w-7" /><span className="text-xl" style={{ fontFamily: 'var(--rl-display), Georgia, serif' }}>{name}</span></div>
            <p className="mt-3 max-w-xs text-sm opacity-75">Small-batch coffee from the foothills of the Cascades. Roasting since 2014.</p>
          </div>
          <FooterCol title="Shop" items={[['All coffee', '/store/ridgeline#coffee'], ['Brew gear', '/store/ridgeline#gear'], ['Cart', '/store/ridgeline/checkout']]} />
          <FooterCol title="Ridgeline" items={[['Our roastery', '/store/ridgeline#story'], ['Brew guides', '/store/ridgeline#story'], ['Wholesale', '/store/ridgeline#story']]} />
          <div>
            <p className="text-sm font-semibold">Roast day notes</p>
            <p className="mt-2 text-sm opacity-75">One email a month: what we’re roasting and why.</p>
            <form className="mt-3 flex gap-2" action="/store/ridgeline" method="get">
              <label className="sr-only" htmlFor="rl-email">Email</label>
              <input id="rl-email" type="email" placeholder="you@example.com" className="h-10 min-w-0 flex-1 rounded-md border-0 px-3 text-sm" style={{ background: R.pineSoft, color: R.oat }} />
              <button className="h-10 rounded-md px-4 text-sm font-semibold" style={{ background: R.oat, color: R.pine }}>Join</button>
            </form>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: 'rgba(247,243,236,.15)' }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs opacity-80">
            <span>© {name}. A demo store for Lintel.</span>
            <span className="flex items-center gap-2">
              We accept major cards
              {installed && (
                <span data-paypal="accepted" className="rounded px-2 py-0.5 font-semibold" style={{ background: '#ffc439', color: '#003087' }}>
                  Pay with PayPal
                </span>
              )}
            </span>
          </div>
        </div>
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

function FooterCol({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm opacity-75">
        {items.map(([l, h]) => <li key={l}><Link href={h} className="hover:opacity-100">{l}</Link></li>)}
      </ul>
    </div>
  );
}
