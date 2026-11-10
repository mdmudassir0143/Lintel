'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import type { Product } from '@/lib/catalog';

type Summary = {
  merchant: { id: string; name: string; storeUrl: string; installed: boolean; raw: Product[] };
  orders: { id: string; paypal_order_id: string; capture_id: string; amount: string; items: { sku: string; qty: number }[]; payer_email: string | null; created_at: number }[];
  scans: { id: string; score: number; created_at: number }[];
};
type Bundle = { cleanCatalog: Product[]; toolDescriptions: Record<string, string>; snippets: { headTags: string; jsonLd: Record<string, string> } };

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-ink p-4 pt-11 text-xs leading-relaxed text-stone">{code}</pre>
      <button
        onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        className="absolute right-2 top-2 rounded bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function MerchantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [working, setWorking] = useState<'' | 'install' | 'reset' | 'scan'>('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([fetch(`/api/merchant/${id}/orders`).then((r) => r.json()), fetch(`/api/merchant/${id}/install`).then((r) => r.json())]);
    setSummary(s);
    setBundle(b.bundle ?? null);
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function setInstalled(installed: boolean) {
    setWorking(installed ? 'install' : 'reset');
    setError('');
    const r = await fetch(`/api/merchant/${id}/install`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ installed }) });
    const b = await r.json();
    if (!r.ok) setError(b.error ?? 'Something went wrong.');
    if (b.bundle) setBundle(b.bundle);
    await load();
    setWorking('');
  }

  async function scanStore() {
    if (!summary) return;
    setWorking('scan');
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: summary.merchant.storeUrl }) });
    const b = await r.json();
    if (r.ok) router.push(`/scan/${b.scanId}`);
    else { setError(b.error); setWorking(''); }
  }

  if (!summary) return <Shell><p className="pt-16">Loading…</p></Shell>;
  const { merchant, orders, scans } = summary;
  const clean = bundle?.cleanCatalog ?? [];

  return (
    <Shell>
      <div className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink/60">Merchant</p>
          <h1 className="wide text-4xl font-extrabold">{merchant.name}</h1>
          <a href={merchant.storeUrl} target="_blank" rel="noreferrer" className="text-sm text-steel underline underline-offset-4">{merchant.storeUrl}</a>
        </div>
        <div className="flex flex-wrap gap-3">
          {merchant.installed ? (
            <button onClick={() => setInstalled(false)} disabled={!!working} className="rounded-md border border-ink px-4 py-2 font-semibold disabled:opacity-60">
              {working === 'reset' ? 'Removing…' : 'Remove Lintel (back to before)'}
            </button>
          ) : (
            <button onClick={() => setInstalled(true)} disabled={!!working} className="rounded-md bg-steel px-5 py-3 font-semibold text-white hover:bg-steel-deep disabled:opacity-60">
              {working === 'install' ? 'Rewriting your catalog for agents…' : 'Fix it with Lintel'}
            </button>
          )}
          <button onClick={scanStore} disabled={!!working} className="rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60">
            {working === 'scan' ? 'Starting scan…' : 'Scan the store'}
          </button>
        </div>
      </div>
      {working === 'install' && <p className="mt-4 text-sm text-ink/70">AI is rewriting product names and details so agents can match them. This takes up to a minute.</p>}
      {error && <p className="mt-4 text-sm text-fail">{error}</p>}

      <section className="mt-10 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-5">
          <p className="text-sm text-ink/60">Status</p>
          <p className={`wide mt-1 text-xl font-bold ${merchant.installed ? 'text-pass' : 'text-fail'}`}>{merchant.installed ? 'Open to AI agents' : 'Closed to AI agents'}</p>
        </div>
        <div className="rounded-lg bg-white p-5">
          <p className="text-sm text-ink/60">Score history</p>
          <p className="num wide mt-1 text-xl font-bold">{scans.length ? [...scans].reverse().map((s) => s.score).join(' → ') : 'No scans yet'}</p>
        </div>
        <div className="rounded-lg bg-white p-5">
          <p className="text-sm text-ink/60">Paid by AI agents through PayPal</p>
          <p className="num wide mt-1 text-xl font-bold">${orders.reduce((s, o) => s + Number(o.amount), 0).toFixed(2)} <span className="text-base font-normal text-ink/60">in {orders.length} orders</span></p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="wide text-2xl font-bold">Agent orders</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-ink/60">No agent has bought anything yet. Install Lintel, then send an agent from a scan.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="num w-full min-w-[640px] text-left text-sm">
              <thead className="text-ink/60">
                <tr><th className="py-2 font-normal">When</th><th className="font-normal">Items</th><th className="font-normal">Amount</th><th className="font-normal">PayPal order</th><th className="font-normal">Capture</th></tr>
              </thead>
              <tbody className="divide-y divide-mortar/30 border-y border-mortar/30">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3">{new Date(o.created_at).toLocaleString()}</td>
                    <td>{o.items.map((i) => `${i.qty}× ${i.sku}`).join(', ')}</td>
                    <td className="font-semibold">${o.amount}</td>
                    <td>{o.paypal_order_id}</td>
                    <td>{o.capture_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="wide text-2xl font-bold">Your catalog, as agents see it</h2>
        <p className="mt-2 max-w-2xl text-ink/70">Agents match requests like “Ethiopian coffee under $25” against product names and details. Lintel rewrites them clearly. Prices and SKUs never change.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-ink/60"><tr><th className="py-2 font-normal">SKU</th><th className="font-normal">Before</th><th className="font-normal">After Lintel</th><th className="font-normal">Price</th></tr></thead>
            <tbody className="divide-y divide-mortar/30 border-y border-mortar/30">
              {merchant.raw.map((p) => {
                const c = clean.find((x) => x.sku === p.sku);
                return (
                  <tr key={p.sku} className="align-top">
                    <td className="num py-3 text-ink/60">{p.sku}</td>
                    <td className="py-3 text-ink/60">{p.title}</td>
                    <td className="py-3">
                      {c ? (
                        <>
                          <span className="font-semibold">{c.title}</span>
                          <span className="block text-ink/60">{Object.entries(c.attributes).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(' · ')}</span>
                        </>
                      ) : (
                        <span className="text-ink/40">Not rewritten yet</span>
                      )}
                    </td>
                    <td className="num py-3">${p.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {bundle && (
        <section className="mt-14 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="wide text-2xl font-bold">Install snippet</h2>
            <p className="mt-2 text-ink/70">Paste into your store&apos;s &lt;head&gt;. It adds agent tools (WebMCP) and an agent checkout that settles through PayPal.</p>
            <div className="mt-4"><Snippet code={bundle.snippets.headTags} /></div>
          </div>
          <div>
            <h2 className="wide text-2xl font-bold">Tools agents get</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {Object.entries(bundle.toolDescriptions).map(([name, d]) => (
                <div key={name}><dt className="font-semibold">{name.replaceAll('_', ' ')}</dt><dd className="text-ink/70">{d}</dd></div>
              ))}
            </dl>
          </div>
        </section>
      )}
    </Shell>
  );
}
