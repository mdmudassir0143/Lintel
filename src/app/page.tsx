'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const demo = typeof window === 'undefined' ? '' : `${window.location.origin}/store/ridgeline`;

  async function scan(target: string) {
    setBusy(true);
    setError('');
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: target }) });
    const b = await r.json();
    if (!r.ok) {
      setBusy(false);
      return setError(b.error ?? 'Could not start the scan.');
    }
    router.push(`/scan/${b.scanId}`);
  }

  return (
    <Shell>
      <section className="grid gap-12 pt-10 md:grid-cols-[1.3fr_1fr] md:pt-20">
        <div>
          <h1 className="wide max-w-xl text-5xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">
            Can AI agents buy from your store?
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/75">
            Shoppers now send AI agents to find and buy things for them. Lintel checks whether those agents can get through your door,
            fixes what blocks them, and makes sure you get paid through PayPal.
          </p>
          <form
            className="mt-10 flex max-w-xl flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) scan(url.trim());
            }}
          >
            <label className="sr-only" htmlFor="url">Store address</label>
            <input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourstore.com"
              className="min-w-0 flex-1 rounded-md border border-mortar/60 bg-white px-4 py-3 text-base outline-none focus:border-steel"
            />
            <button disabled={busy} className="rounded-md bg-steel px-6 py-3 font-semibold text-white hover:bg-steel-deep disabled:opacity-60">
              {busy ? 'Scanning…' : 'Scan my store'}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-fail">{error}</p>}
          <button onClick={() => scan(demo)} disabled={busy} className="mt-5 text-sm text-steel underline underline-offset-4 hover:text-steel-deep">
            Or scan our demo shop, Ridgeline Coffee Roasters
          </button>
        </div>
        <div className="hidden items-end md:flex" aria-hidden>
          <div className="w-full">
            <div className="flex h-8 gap-[3px]">
              {[30, 15, 10, 10, 10, 10, 5, 5, 5].map((w, i) => (
                <div key={i} style={{ flexGrow: w, animationDelay: `${i * 90}ms` }} className="stone basis-0 rounded-[2px] bg-ink" />
              ))}
            </div>
            <div className="flex justify-between">
              <div className="h-56 w-[12%] bg-stone-deep" />
              <div className="h-56 w-[12%] bg-stone-deep" />
            </div>
          </div>
        </div>
      </section>
      <section className="mt-24 grid gap-10 border-t border-mortar/40 pt-10 md:grid-cols-3">
        {[
          ['Scan', 'Nine checks that matter to AI shoppers, from blocked bots to hidden prices, scored out of 100.'],
          ['Watch', 'A real AI agent tries to buy from your store while you watch every step it takes.'],
          ['Fix and get paid', 'One script tag gives agents tools to shop, and checkout settles through PayPal after the buyer approves.'],
        ].map(([t, d]) => (
          <div key={t}>
            <h2 className="wide text-lg font-bold">{t}</h2>
            <p className="mt-2 leading-relaxed text-ink/70">{d}</p>
          </div>
        ))}
      </section>
    </Shell>
  );
}
