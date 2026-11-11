'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { PayPalMark } from '@/components/brand';
import { Button, ButtonLink, Panel, PanelHeader, Pill, Spinner, timeAgo } from '@/components/ui';
import { scoreState } from '@/components/LintelScore';
import { RUN_STATUS, type StoreSummary, type SetupStepView } from '@/lib/ui/types';
import type { Product } from '@/lib/catalog';
import { PLATFORM_GUIDES, guideFor, CSV_TEMPLATE } from '@/lib/platformGuides';
import { ShopifyMark } from '@/components/brand';

type Bundle = { cleanCatalog: Product[]; toolDescriptions: Record<string, string>; snippets: { headTags: string; jsonLd: Record<string, string> } };
type Busy = '' | 'shopify' | 'woocommerce' | 'sitemap' | 'page' | 'csv' | 'platform' | 'rewrite' | 'verify' | 'paypal' | 'agent' | 'scan' | 'off';

const input = 'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10';

export default function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<StoreSummary | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [busy, setBusy] = useState<Busy>('');
  const [note, setNote] = useState<{ step?: string; ok: boolean; text: string } | null>(null);
  const [missing, setMissing] = useState(false);
  const [csv, setCsv] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [openStep, setOpenStep] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([fetch(`/api/merchant/${id}/orders`), fetch(`/api/merchant/${id}/install`)]);
    if (!s.ok) return setMissing(true);
    const d: StoreSummary = await s.json();
    setData(d);
    setPaypalEmail((p) => p || d.merchant.paypalEmail || '');
    if (b.ok) setBundle((await b.json()).bundle ?? null);
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  async function call(kind: Busy, url: string, body: unknown, ok: string, step?: string) {
    setBusy(kind);
    setNote(null);
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const b = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok || b.ok === false) {
      setNote({ step, ok: false, text: b.error ?? b.message ?? 'Something went wrong. Try again.' });
      return null;
    }
    setNote({ step, ok: true, text: ok });
    if (b.bundle) setBundle(b.bundle);
    await load();
    return b;
  }

  async function sendAgent() {
    setBusy('agent');
    const r = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'browser', merchantId: id, scanId: data?.summary.latestScanId ?? undefined }) });
    const b = await r.json();
    if (!r.ok) { setBusy(''); return setNote({ step: 'test', ok: false, text: b.error ?? 'Couldn’t start the agent.' }); }
    router.push(`/app/run/${b.runId}`);
  }

  async function scan() {
    if (!data) return;
    setBusy('scan');
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: data.merchant.storeUrl, merchantId: id }) });
    const b = await r.json();
    if (r.ok) router.push(`/app/scan/${b.scanId}`);
    else { setBusy(''); setNote({ ok: false, text: b.error ?? 'Couldn’t start the scan.' }); }
  }

  const crumbs = [{ label: 'Stores', href: '/app' }, { label: data?.merchant.name ?? 'Store' }];
  if (missing) return <AppShell crumbs={crumbs}><p className="pt-12 text-muted">This store doesn’t exist, or you don’t have access to it.</p></AppShell>;
  if (!data) return <AppShell crumbs={crumbs}><p className="flex items-center gap-2 pt-12 text-muted"><Spinner /> Loading the store</p></AppShell>;

  const { merchant, orders, runs, summary } = data;
  const setup = summary.setup;
  const doneCount = setup.filter((s) => s.done).length;
  const current = openStep ?? setup.find((s) => !s.done)?.id ?? null;
  const clean = merchant.installed ? bundle?.cleanCatalog ?? [] : [];
  const st = summary.latestScore != null ? scoreState(summary.latestScore) : null;
  const guide = guideFor(summary.platform);
  const canShopify = !!data.providers?.shopify && !merchant.isDemo && !summary.shopifyConnected && (summary.platform === 'shopify' || summary.platform == null);
  const msg = (step: string) =>
    note && !note.ok && note.step === step && (
      <p role={note.ok ? 'status' : 'alert'} className={`mt-3 rounded-lg px-3 py-2 text-sm ${note.ok ? 'bg-success-wash text-success-ink' : 'bg-danger-wash text-danger'}`}>{note.text}</p>
    );

  const stepBody: Record<SetupStepView['id'], ReactNode> = {
    catalog: merchant.isDemo ? (
      <p className="text-soft">The demo store comes with 6 products.</p>
    ) : (
      <div className="space-y-5">
        <p className="text-soft">
          Agents buy from your product list.{' '}
          {summary.productCount ? <><span className="font-medium text-ink">{summary.productCount} products imported.</span> Import again any time to replace them.</> : 'Pick whichever is easiest.'}
        </p>
        {guide?.autoImport && (
          <div className="grid gap-3 sm:grid-cols-2">
            {guide.autoImport.map((a) => (
              <button key={a.source} disabled={!!busy} onClick={() => call(a.source, `/api/merchant/${id}/catalog`, { source: a.source }, 'Products imported.', 'catalog')}
                className="rounded-xl border border-line-strong bg-surface p-4 text-left hover:border-brand disabled:opacity-60">
                <span className="flex items-center gap-2 font-semibold">{busy === a.source ? <Spinner /> : <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" /></svg>} {a.label}</span>
                <span className="mt-1 block text-sm text-muted">{a.note}</span>
              </button>
            ))}
          </div>
        )}
        <CsvImport
          busy={busy === 'csv'}
          disabled={!!busy}
          steps={guide?.exportSteps ?? PLATFORM_GUIDES[PLATFORM_GUIDES.length - 1].exportSteps}
          platform={guide && guide.id !== 'other' ? guide.label : 'most shop systems'}
          onImport={(text) => call('csv', `/api/merchant/${id}/catalog`, { source: 'csv', csv: text }, 'CSV imported.', 'catalog')}
        />
        {msg('catalog')}
      </div>
    ),
    rewrite: (
      <div>
        <p className="text-soft">AI rewrites product names and details so agents can match requests like “Ethiopian coffee under $25”. Prices and SKUs never change. This also switches on your agent checkout.</p>
        <Button className="mt-4" disabled={!!busy || !summary.productCount} onClick={() => call('rewrite', `/api/merchant/${id}/install`, { installed: true }, 'Catalog rewritten. Your agent checkout is on.', 'rewrite')}>
          {busy === 'rewrite' && <Spinner />} {busy === 'rewrite' ? 'Rewriting your catalog' : merchant.installed ? 'Rewrite again' : 'Rewrite with AI'}
        </Button>
        {!summary.productCount && <p className="mt-2 text-sm text-muted">Import your products first.</p>}
        {msg('rewrite')}
      </div>
    ),
    snippet: merchant.isDemo ? (
      <p className="text-soft">The demo store loads the snippet automatically once its catalog is rewritten.</p>
    ) : summary.shopifyConnected && summary.installVerified ? (
      <p className="text-soft">Added to your Shopify storefront automatically when you connected Shopify.</p>
    ) : (
      <div>
        {bundle ? <Snippet code={bundle.snippets.headTags} /> : <p className="text-sm text-muted">Rewrite your catalog first to get your snippet.</p>}
        <ol className="mt-5 space-y-2.5">
          {(guide ?? PLATFORM_GUIDES[PLATFORM_GUIDES.length - 1]).snippetSteps.map((t, i) => (
            <li key={i} className="flex gap-3 text-[15px]"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-subtle-strong text-[12px] font-semibold">{i + 1}</span><span className="pt-0.5">{t}</span></li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={!!busy || !bundle} onClick={() => call('verify', `/api/merchant/${id}/verify`, {}, 'Snippet found on your store. We’re rescanning it now.', 'snippet')}>{busy === 'verify' && <Spinner />} Check my store</Button>
          {bundle && (
            <a className="text-sm font-medium text-brand hover:text-brand-hover"
              href={`mailto:?subject=${encodeURIComponent(`Please add the Lintel snippet to ${merchant.name}`)}&body=${encodeURIComponent(`Hi,\n\nPlease add this to the <head> of every page on ${merchant.storeUrl}:\n\n${bundle.snippets.headTags}\n\nSteps for ${(guide ?? PLATFORM_GUIDES[6]).label}:\n${(guide ?? PLATFORM_GUIDES[6]).snippetSteps.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nThanks!`)}`}>
              Email these steps to my developer
            </a>
          )}
        </div>
        {msg('snippet')}
      </div>
    ),
    paypal: merchant.isDemo ? (
      <p className="text-soft">Demo purchases go to Lintel’s PayPal sandbox account.</p>
    ) : (
      <div>
        <p className="text-soft">Agent purchases are paid straight into your PayPal business account. During the preview, use the email of a PayPal sandbox business account.</p>
        <div className="mt-4 flex max-w-[520px] flex-col gap-2 sm:flex-row">
          <input value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} type="email" placeholder="payments@yourstore.com" className={input} aria-label="PayPal business email" />
          <Button disabled={!!busy || !paypalEmail.trim()} onClick={() => call('paypal', `/api/merchant/${id}/paypal`, { email: paypalEmail }, 'PayPal account saved. It’s confirmed when your first test payment lands.', 'paypal')}>{busy === 'paypal' && <Spinner />} <PayPalMark className="h-4 w-4" /> Save</Button>
        </div>
        {summary.paypalEmail && (
          <p className={`mt-2 text-sm ${summary.paypalVerified ? 'text-success-ink' : 'text-muted'}`}>
            {summary.paypalVerified ? `Confirmed by a real payment: ${summary.paypalEmail}` : `Saved: ${summary.paypalEmail}. Confirmed after your first test payment.`}
          </p>
        )}
        {msg('paypal')}
      </div>
    ),
    test: (
      <div>
        <p className="text-soft">A real AI agent opens your store in a browser and tries to buy. When it reaches checkout, you approve the payment in PayPal.</p>
        <Button className="mt-4" disabled={!!busy || !merchant.installed} onClick={sendAgent}>{busy === 'agent' && <Spinner />} Send a test agent</Button>
        {!merchant.installed && <p className="mt-2 text-sm text-muted">Rewrite your catalog first so the agent checkout is on.</p>}
        {msg('test')}
      </div>
    ),
  };

  return (
    <AppShell crumbs={crumbs}>
      <div className="flex flex-col gap-5 pt-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-h2">{merchant.name}</h1>
            {merchant.isDemo && <Pill tone="neutral">Demo</Pill>}
            {merchant.installed ? <Pill tone="pass">Agent checkout on</Pill> : <Pill tone="fail">Closed to agents</Pill>}
          </div>
          <a href={merchant.storeUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block truncate text-muted underline decoration-line underline-offset-4 hover:text-ink">{merchant.storeUrl}</a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={scan} disabled={!!busy}>{busy === 'scan' && <Spinner />} Scan the store</Button>
          {merchant.installed && (
            <Button variant="ghost" disabled={!!busy} onClick={() => call('off', `/api/merchant/${id}/install`, { installed: false }, merchant.isDemo ? 'Demo store reset.' : 'Agent checkout turned off.')}>
              {busy === 'off' && <Spinner />} {merchant.isDemo ? 'Reset demo' : 'Turn off for agents'}
            </Button>
          )}
        </div>
      </div>
      {note && !note.step && <p role="alert" className={`mt-4 rounded-lg px-4 py-3 text-[15px] ${note.ok ? 'bg-success-wash text-success-ink' : 'bg-danger-wash text-danger'}`}>{note.text}</p>}

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <Panel className="p-5">
          <p className="t-label">Agent readiness</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="t-stat">{summary.latestScore ?? '—'}<span className="text-base font-medium text-muted">/100</span></p>
            {st && <Pill tone={st.tone}>{st.label}</Pill>}
          </div>
          {summary.latestScanId && <Link href={`/app/scan/${summary.latestScanId}`} className="mt-2 inline-block text-sm font-medium text-brand hover:text-brand-hover">View report</Link>}
        </Panel>
        <Panel className="p-5">
          <p className="t-label">Paid by AI agents</p>
          <p className="t-stat mt-1">${summary.revenue}</p>
          <p className="mt-2 text-sm text-muted">{summary.orders} {summary.orders === 1 ? 'order' : 'orders'}, settled in PayPal</p>
        </Panel>
        <Panel className="p-5">
          <p className="t-label">Agent runs</p>
          <p className="t-stat mt-1">{runs.length}</p>
          <p className="mt-2 text-sm text-muted">{runs.filter((r) => r.status === 'succeeded').length} bought, {runs.filter((r) => r.status === 'failed').length} couldn’t</p>
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelHeader title={doneCount === setup.length ? 'Setup complete' : 'Set up your store for AI agents'} sub={`${doneCount} of ${setup.length} steps done`} />
        {!merchant.isDemo && (
          <div className="border-b border-line px-5 py-5">
            <p className="text-sm font-semibold">How is your store built?</p>
            <p className="mt-0.5 text-sm text-muted">{summary.platform ? 'We detected this from your site. Change it if it’s wrong.' : 'We’ll show the exact steps for your platform.'}</p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Store platform">
              {PLATFORM_GUIDES.map((g) => (
                <button key={g.id} role="radio" aria-checked={summary.platform === g.id} disabled={!!busy}
                  onClick={() => call('platform', `/api/merchant/${id}/platform`, { platform: g.id }, '', 'platform-silent')}
                  className={`h-9 rounded-full border px-3.5 text-sm font-medium ${summary.platform === g.id ? 'border-brand bg-brand-wash text-brand-ink' : 'border-line-strong bg-surface text-soft hover:border-ink/40'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            {summary.platform === 'shopify' && (
              <div className="mt-4 rounded-xl border border-brand/20 bg-brand-wash/60 p-4">
                <p className="font-semibold">On Shopify? Turn on Shopify’s Agentic Storefronts first</p>
                <p className="mt-1 max-w-[680px] text-sm leading-relaxed text-soft">
                  Shopify can list your products in ChatGPT, Copilot and other assistants it partners with, with checkout handled by Shopify.
                  Lintel adds what that doesn’t: your readiness score, testing with a real agent, and a PayPal checkout any agent can use.
                </p>
                {summary.shopifyShop ? (
                  <a href={`https://admin.shopify.com/store/${summary.shopifyShop.replace('.myshopify.com', '')}/apps/agentic`} target="_blank" rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-hover">
                    <ShopifyMark className="h-4 w-4" /> Open Agentic Storefronts in Shopify
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-muted">In Shopify admin, open Sales channels, then Agentic.</p>
                )}
              </div>
            )}
            {canShopify && (
              <form action="/api/auth/shopify" method="get" className="mt-4 flex flex-col gap-3 rounded-xl border border-line-strong bg-subtle p-4 sm:flex-row sm:items-center">
                <ShopifyMark className="h-7 w-7 shrink-0 text-[#5e8e3e]" />
                <div className="flex-1">
                  <p className="font-semibold">Import from Shopify in one step</p>
                  <p className="text-sm text-muted">One approval imports your products and adds Lintel’s agent checkout to your storefront.</p>
                </div>
                <input type="hidden" name="store" value={id} />
                <input name="shop" required placeholder="your-store.myshopify.com" aria-label="Shopify store address" className={`${input} sm:w-64`} />
                <Button type="submit">Connect</Button>
              </form>
            )}
            {summary.shopifyConnected && <p className="mt-3 flex items-center gap-2 text-sm text-success-ink"><ShopifyMark className="h-4 w-4" /> Connected to Shopify</p>}
          </div>
        )}
        {note?.ok && note.step && note.text && (
          <p role="status" className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-success-wash px-3.5 py-2.5 text-sm font-medium text-success-ink">
            <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-success text-[11px] text-white">✓</span>{note.text}
          </p>
        )}
        <div className="px-5 pt-4">
          <div className="flex gap-1">{setup.map((s) => <span key={s.id} className={`h-1.5 flex-1 rounded-full ${s.done ? 'bg-brand' : 'bg-line'}`} />)}</div>
        </div>
        <ol className="divide-y divide-line">
          {setup.map((s, i) => {
            const open = current === s.id;
            return (
              <li key={s.id}>
                <button onClick={() => setOpenStep(open ? '' : s.id)} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-subtle/60">
                  <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${s.done ? 'bg-brand text-white' : open ? 'bg-ink text-white' : 'bg-subtle-strong text-muted'}`}>
                    {s.done ? '✓' : i + 1}
                  </span>
                  <span className={`flex-1 font-semibold ${s.done ? 'text-muted' : ''}`}>{s.title}</span>
                  <span className="text-sm text-muted">{s.done ? 'Done' : open ? '' : 'Open'}</span>
                </button>
                {open && <div className="px-5 pb-6 sm:pl-[4.25rem]">{stepBody[s.id]}</div>}
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title="Agent orders" sub="Purchases AI agents made and paid for through PayPal." />
        {orders.length === 0 ? (
          <p className="px-5 py-8 text-[15px] text-muted">No agent has bought anything yet. Finish setup and send a test agent.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="num w-full min-w-[680px] text-left text-[14px]">
              <thead className="text-[13px] text-muted">
                <tr className="border-b border-line"><th className="px-5 py-2.5 font-medium">When</th><th className="font-medium">Items</th><th className="font-medium">Amount</th><th className="font-medium">PayPal order</th><th className="px-5 font-medium">Capture</th></tr>
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

      {merchant.raw.length > 0 && (
        <Panel className="mt-6">
          <PanelHeader title="Your catalog, as agents see it" sub={`${merchant.raw.length} products. Prices and SKUs never change.`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="text-[13px] text-muted">
                <tr className="border-b border-line"><th className="px-5 py-2.5 font-medium">SKU</th><th className="font-medium">Before</th><th className="font-medium">After Lintel</th><th className="px-5 font-medium">Price</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {merchant.raw.slice(0, 50).map((p) => {
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
                              {Object.entries(c.attributes).slice(0, 4).map(([k, v]) => <span key={k} className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-muted">{k.replaceAll('_', ' ')}: {v}</span>)}
                            </span>
                          </>
                        ) : <span className="text-muted/70">Rewritten in step 2</span>}
                      </td>
                      <td className="num px-5 py-3">${p.price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {runs.length > 0 && (
        <Panel className="mt-6">
          <PanelHeader title="Agent runs" />
          <ul className="divide-y divide-line">
            {runs.slice(0, 8).map((r) => (
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
      <div className="mt-8"><ButtonLink href="/app" variant="ghost" size="sm">Back to stores</ButtonLink></div>
    </AppShell>
  );
}

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl bg-night">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[13px] text-white/60">
        <span>Paste into your store’s &lt;head&gt;</span>
        <button onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className="rounded px-2 py-0.5 font-medium text-white hover:bg-white/10">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-all p-4 font-mono text-[12.5px] leading-[1.7] text-white/85">{code}</pre>
    </div>
  );
}

/** Upload (or paste) a product CSV, with the export steps for the merchant's platform and a template. */
function CsvImport({ steps, platform, busy, disabled, onImport }: { steps: string[]; platform: string; busy: boolean; disabled: boolean; onImport: (text: string) => void }) {
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState('');
  const read = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    f.text().then((t) => onImport(t));
  };
  const template = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lintel-products-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-xl border border-line-strong p-4">
      <p className="font-semibold">Upload a product CSV</p>
      <ol className="mt-2 space-y-1.5 text-sm text-soft">
        {steps.map((t, i) => <li key={i} className="flex gap-2"><span className="num text-muted">{i + 1}.</span>{t}</li>)}
      </ol>
      {!paste ? (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) read(e.dataTransfer.files[0]); }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center ${drag ? 'border-brand bg-brand-wash' : 'border-line-strong hover:border-brand'}`}
        >
          <input type="file" accept=".csv,text/csv" className="sr-only" disabled={disabled} onChange={(e) => read(e.target.files?.[0])} />
          {busy ? <span className="flex items-center gap-2 text-sm font-medium"><Spinner /> Importing {fileName}</span> : (
            <>
              <span className="text-[15px] font-semibold">Drop your CSV here, or click to choose a file</span>
              <span className="mt-1 text-[13px] text-muted">Exports from {platform} work as they are.</span>
            </>
          )}
        </label>
      ) : (
        <div className="mt-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Product CSV"
            placeholder={'sku,title,description,price,in_stock\nKEN-12,Kenya AA 12 oz,Bright and juicy,21.00,yes'}
            className="w-full rounded-lg border border-line-strong bg-surface p-3 font-mono text-[13px] outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
          <Button className="mt-2" disabled={disabled || !text.trim()} onClick={() => onImport(text)}>{busy && <Spinner />} Import CSV</Button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <button type="button" onClick={template} className="font-medium text-brand hover:text-brand-hover">Download a template</button>
        <button type="button" onClick={() => setPaste((p) => !p)} className="font-medium text-brand hover:text-brand-hover">{paste ? 'Upload a file instead' : 'Paste CSV text instead'}</button>
      </div>
    </div>
  );
}
