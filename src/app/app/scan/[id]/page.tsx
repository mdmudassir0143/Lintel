'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { LintelScore, Beam, CHECK_ORDER } from '@/components/LintelScore';
import { Button, ButtonLink, Panel, PanelHeader, Pill, Spinner, timeAgo } from '@/components/ui';
import type { CheckResult } from '@/lib/scan/checks';

type Scan = { id: string; url: string; merchant_id: string | null; status: string; checks: CheckResult[]; score: number; findings: string[]; created_at?: number };

const STATUS = { pass: { label: 'Pass', tone: 'pass' }, partial: { label: 'Partly', tone: 'wait' }, fail: { label: 'Fail', tone: 'fail' } } as const;

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [starting, setStarting] = useState<'' | 'browser' | 'headless' | 'rescan'>('');
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/scan/${id}`);
      if (!r.ok) return setMissing(true);
      const s: Scan = await r.json();
      if (stop) return;
      setScan(s);
      if (s.status === 'running') setTimeout(tick, 1200);
    };
    tick();
    return () => { stop = true; };
  }, [id]);

  async function sendAgent(kind: 'browser' | 'headless') {
    if (!scan) return;
    setStarting(kind);
    setError('');
    const r = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, url: scan.url, scanId: scan.id, merchantId: scan.merchant_id }) });
    const b = await r.json();
    if (!r.ok) { setStarting(''); return setError(b.error ?? 'Couldn’t start the agent.'); }
    router.push(`/app/run/${b.runId}`);
  }

  async function rescan() {
    if (!scan) return;
    setStarting('rescan');
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: scan.url }) });
    const b = await r.json();
    if (r.ok) router.push(`/app/scan/${b.scanId}`);
    else { setStarting(''); setError(b.error ?? 'Couldn’t start the scan.'); }
  }

  const crumbs = [{ label: 'Overview', href: '/app' }, { label: 'Readiness report' }];

  if (missing)
    return (
      <AppShell crumbs={crumbs}>
        <div className="pt-16">
          <h1 className="t-h2">This report doesn’t exist</h1>
          <p className="mt-2 text-muted">It may have been from an earlier session. Start a new scan from the overview.</p>
          <ButtonLink href="/app" className="mt-6">Go to overview</ButtonLink>
        </div>
      </AppShell>
    );

  if (!scan || scan.status === 'running')
    return (
      <AppShell crumbs={crumbs}>
        <div className="max-w-[720px] pt-12">
          <p className="flex items-center gap-2 text-sm text-muted"><Spinner /> Scanning</p>
          <h1 className="t-h2 mt-3 break-words">{scan?.url ?? 'Your store'}</h1>
          <p className="mt-2 text-muted">Reading your pages, robots.txt and checkout the way an AI agent would. This takes a few seconds.</p>
          <div className="mt-10 flex h-9 gap-[3px]">
            {CHECK_ORDER.map((c, i) => (
              <div key={c} className="pulse-dot basis-0 border border-dashed border-muted/40" style={{ flexGrow: [30, 15, 10, 10, 10, 10, 5, 5, 5][i], animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      </AppShell>
    );

  const live = scan.checks.find((c) => c.id === 'live_agent');
  const tested = live && live.evidence !== 'Not tested yet — run the agent';
  const visible = scan.checks.filter((c) => c.id !== 'site_unreachable' || c.status === 'fail');
  const failing = visible.filter((c) => c.status !== 'pass').length;
  const onlyLiveLeft = failing === 1 && live?.status !== 'pass';
  const order = { fail: 0, partial: 1, pass: 2 } as const;
  const sorted = [...visible].sort((a, b) => order[a.status] - order[b.status]);
  const installed = scan.checks.find((c) => c.id === 'webmcp_tools')?.status === 'pass';
  const bullet = failing === 0 ? 'bg-success' : onlyLiveLeft ? 'bg-warning' : 'bg-danger';

  return (
    <AppShell crumbs={crumbs}>
      <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="t-h2">Readiness report</h1>
          <p className="mt-1 truncate text-muted">
            <a href={scan.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{scan.url}</a>
            {scan.created_at ? `, scanned ${timeAgo(scan.created_at)}` : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={rescan} disabled={!!starting}>
          {starting === 'rescan' && <Spinner />} Scan again
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel className="p-6 sm:p-8">
          <LintelScore checks={scan.checks} score={scan.score} />
          <h2 className="mt-8 text-[15px] font-semibold">
            {failing === 0 ? 'Nothing is stopping AI agents here' : onlyLiveLeft ? 'One step left: prove an agent can buy' : 'What’s stopping AI agents'}
          </h2>
          <ul className="mt-3 space-y-3">
            {scan.findings.map((f, i) => (
              <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-2 leading-relaxed text-ink/85">
                <span aria-hidden className={`mt-2 h-1.5 w-1.5 rounded-full ${bullet}`} />
                {f}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Send an AI agent to buy" sub="The real test, worth 30 points." />
            <div className="space-y-3 p-5">
              <p className="text-[15px] leading-relaxed text-muted">
                {tested ? live!.evidence : 'Its goal: buy one 12 oz bag of Ethiopian coffee for under $25. If it reaches checkout, you approve the payment in PayPal.'}
              </p>
              <Button className="w-full" size="lg" onClick={() => sendAgent('browser')} disabled={!!starting}>
                {starting === 'browser' && <Spinner />} Watch an agent shop in a browser
              </Button>
              <Button className="w-full" variant="secondary" onClick={() => sendAgent('headless')} disabled={!!starting}>
                {starting === 'headless' && <Spinner />} Send an API-only agent
              </Button>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            </div>
          </Panel>
          {scan.merchant_id && (
            <Panel className="border-ink bg-night text-white">
              <div className="p-5">
                <p className="font-semibold">{installed ? 'Lintel is installed on this store' : 'Fix this store with Lintel'}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">
                  {installed ? 'See agent orders, PayPal payouts and the catalog agents read in the store dashboard.' : 'One script tag removes these walls, rewrites the catalog for agents, and adds a PayPal checkout they can use.'}
                </p>
                <ButtonLink href={`/app/stores/${scan.merchant_id}`} variant="primary" className="mt-4 w-full">
                  {installed ? 'Open store dashboard' : 'Fix this store'}
                </ButtonLink>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel className="mt-6">
        <PanelHeader title="All nine checks" sub="Each segment is one check, as wide as its points." />
        <div className="px-5 pt-5"><Beam checks={scan.checks} className="h-2.5" animate={false} /></div>
        <ul className="mt-3 divide-y divide-line">
          {sorted.map((c) => {
            const earned = c.earned ?? Math.round(c.weight * { pass: 1, partial: 0.5, fail: 0 }[c.status]);
            return (
              <li key={c.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[6.5rem_1fr_4rem] sm:gap-4">
                <span><Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill></span>
                <div className="min-w-0">
                  <p className="font-semibold">{c.title}</p>
                  <p className="mt-0.5 break-words text-[15px] text-ink/80">{c.evidence}</p>
                  <p className="mt-1 text-sm text-muted">{c.why}</p>
                </div>
                <span className="num text-sm text-muted sm:text-right"><span className="font-semibold text-ink">{earned}</span> / {c.weight}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </AppShell>
  );
}
