'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Button, ButtonLink, Panel, PanelHeader, Pill, Spinner, timeAgo } from '@/components/ui';
import { scoreTone } from '@/components/LintelScore';
import { RUN_STATUS, type StoreSummary } from '@/lib/ui/types';
import type { Product } from '@/lib/catalog';

type Bundle = { cleanCatalog: Product[]; toolDescriptions: Record<string, string>; snippets: { headTags: string; jsonLd: Record<string, string> } };

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl bg-night">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[13px] text-white/50">
        <span>Paste into your store’s &lt;head&gt;</span>
        <button
          onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
          className="rounded px-2 py-0.5 font-medium text-white hover:bg-white/10"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-all p-4 font-mono text-[12.5px] leading-[1.7] text-white/85">{code}</pre>
    </div>
  );
}

export default function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [summary, setSummary] = useState<StoreSummary | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [working, setWorking] = useState<'' | 'install' | 'reset' | 'scan'>('');
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([fetch(`/api/merchant/${id}/orders`), fetch(`/api/merchant/${id}/install`)]);
    if (!s.ok) return setMissing(true);
    setSummary(await s.json());
    if (b.ok) setBundle((await b.json()).bundle ?? null);
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
    if (!r.ok) setError(b.error ?? 'Something went wrong. Try again.');
    if (b.bundle) setBundle(b.bundle);
    await load();
    setWorking('');
  }

  async function scanStore() {
    if (!summary) return;
    setWorking('scan');
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: summary.merchant.storeUrl }) });
    const b = await r.json();
    if (r.ok) router.push(`/app/scan/${b.scanId}`);
    else { setError(b.error ?? 'Couldn’t start the scan.'); setWorking(''); }
  }

  if (missing)
    return <AppShell crumbs={[{ label: 'Overview', href: '/app' }, { label: 'Store' }]}><p className="pt-12 text-muted">This store doesn’t exist.</p></AppShell>;
  if (!summary)
    return <AppShell crumbs={[{ label: 'Overview', href: '/app' }, { label: 'Store' }]}><p className="flex items-center gap-2 pt-12 text-muted"><Spinner /> Loading the store</p></AppShell>;

  const { merchant, orders, scans, runs } = summary;
  const clean = merchant.installed ? bundle?.cleanCatalog ?? [] : [];
  const revenue = orders.reduce((s, o) => s + Number(o.amount), 0);
  const history = [...scans].reverse();
  const latest = scans[0];

  return (
    <AppShell crumbs={[{ label: 'Overview', href: '/app' }, { label: merchant.name }]}>
      <div className="flex flex-col gap-5 pt-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-h2">{merchant.name}</h1>
            {merchant.installed ? <Pill tone="pass">Open to agents</Pill> : <Pill tone="fail">Closed to agents</Pill>}
          </div>
          <a href={merchant.storeUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block truncate text-muted underline decoration-line underline-offset-4 hover:text-ink">{merchant.storeUrl}</a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={scanStore} disabled={!!working}>{working === 'scan' && <Spinner />} Scan the store</Button>
          {merchant.installed && (
            <Button variant="ghost" onClick={() => setInstalled(false)} disabled={!!working}>{working === 'reset' && <Spinner />} Uninstall Lintel</Button>
          )}
        </div>
      </div>

      {working === 'install' && (
        <p className="mt-4 rounded-lg bg-brand-wash px-4 py-3 text-[15px] text-brand-ink">AI is rewriting your product names and details so agents can match them. Prices and SKUs stay exactly as they are. This takes a few seconds.</p>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger-wash px-4 py-3 text-[15px] text-danger">{error}</p>}

      {!merchant.installed && working !== 'reset' && (
        <Panel className="mt-6 border-ink bg-night text-white">
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold">AI agents can’t buy from this store yet</p>
              <p className="mt-1 max-w-[640px] text-[15px] text-white/65">Installing Lintel removes the walls agents hit, rewrites the catalog so they can understand it, and adds a checkout they can pay through with PayPal.</p>
            </div>
            <Button size="lg" onClick={() => setInstalled(true)} disabled={!!working}>{working === 'install' && <Spinner />} {working === 'install' ? 'Installing' : 'Install Lintel'}</Button>
          </div>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Readiness score</p>
          <p className={`t-stat mt-1 ${latest ? scoreTone(latest.score) : 'text-muted'}`}>{latest ? latest.score : '—'}<span className="text-base font-medium text-muted"> /100</span></p>
          <p className="num mt-2 text-sm text-muted">{history.length > 1 ? `History: ${history.map((s) => s.score).join(', ')}` : latest ? `Scanned ${timeAgo(latest.created_at)}` : 'Not scanned yet'}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Paid by AI agents</p>
          <p className="t-stat mt-1">${revenue.toFixed(2)}</p>
          <p className="mt-2 text-sm text-muted">{orders.length} {orders.length === 1 ? 'order' : 'orders'}, settled in PayPal</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-[13px] text-muted">Agent runs</p>
          <p className="t-stat mt-1">{runs.length}</p>
          <p className="mt-2 text-sm text-muted">{runs.filter((r) => r.status === 'succeeded').length} bought, {runs.filter((r) => r.status === 'failed').length} couldn’t</p>
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelHeader title="Agent orders" sub="Purchases AI agents made and paid for through PayPal." />
        {orders.length === 0 ? (
          <p className="px-5 py-8 text-[15px] text-muted">No agent has bought anything yet. {merchant.installed ? 'Scan the store and send an agent to buy.' : 'Install Lintel, then send an agent from a scan.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="num w-full min-w-[680px] text-left text-[14px]">
              <thead className="text-[13px] text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-medium">When</th><th className="font-medium">Items</th><th className="font-medium">Amount</th><th className="font-medium">PayPal order</th><th className="px-5 font-medium">Capture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3">{o.run_id ? <Link href={`/app/run/${o.run_id}`} className="underline decoration-line underline-offset-4 hover:decoration-ink">{timeAgo(o.created_at)}</Link> : timeAgo(o.created_at)}</td>
                    <td>{o.items.map((i) => `${i.qty} × ${i.sku}`).join(', ')}</td>
                    <td className="font-semibold">${o.amount}</td>
                    <td className="text-muted">{o.paypal_order_id}</td>
                    <td className="px-5 text-muted">{o.capture_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title="Your catalog, as agents see it" sub="Agents match requests like “Ethiopian coffee under $25” against names and details. Prices and SKUs never change." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="text-[13px] text-muted">
              <tr className="border-b border-line"><th className="px-5 py-2.5 font-medium">SKU</th><th className="font-medium">Before</th><th className="font-medium">After Lintel</th><th className="px-5 font-medium">Price</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {merchant.raw.map((p) => {
                const c = clean.find((x) => x.sku === p.sku);
                return (
                  <tr key={p.sku} className="align-top">
                    <td className="num px-5 py-3 text-muted">{p.sku}</td>
                    <td className="py-3 pr-4 font-mono text-[13px] text-muted">{p.title}</td>
                    <td className="py-3 pr-4">
                      {c ? (
                        <>
                          <span className="font-semibold">{c.title}</span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            {Object.entries(c.attributes).slice(0, 4).map(([k, v]) => (
                              <span key={k} className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-muted">{k.replaceAll('_', ' ')}: {v}</span>
                            ))}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted/70">Rewritten when you install Lintel</span>
                      )}
                    </td>
                    <td className="num px-5 py-3">${p.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {bundle && merchant.installed && (
        <Panel className="mt-6">
          <PanelHeader title="Install" sub="One snippet adds agent tools (WebMCP) and an agent checkout that settles through PayPal." />
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.15fr]">
            <div><Snippet code={bundle.snippets.headTags} /></div>
            <div>
              <p className="text-[13px] font-medium text-muted">Tools agents get, written for your store</p>
              <dl className="mt-2 divide-y divide-line border-y border-line">
                {Object.entries(bundle.toolDescriptions).map(([name, d]) => (
                  <div key={name} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]"><dt className="font-mono text-[12.5px] font-semibold">{name}</dt><dd className="text-[14px] leading-snug text-muted">{d}</dd></div>
                ))}
              </dl>
            </div>
          </div>
        </Panel>
      )}

      {runs.length > 0 && (
        <Panel className="mt-6">
          <PanelHeader title="Agent runs" action={<ButtonLink href="/app" variant="ghost" size="sm">All activity</ButtonLink>} />
          <ul className="divide-y divide-line">
            {runs.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/app/run/${r.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-subtle/60">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{r.summary ?? r.goal}</span>
                    <span className="text-sm text-muted">{r.kind === 'browser' ? 'Browser agent' : 'API agent'}, {timeAgo(r.created_at)}</span>
                  </span>
                  <Pill tone={RUN_STATUS[r.status].tone}>{RUN_STATUS[r.status].label}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AppShell>
  );
}
