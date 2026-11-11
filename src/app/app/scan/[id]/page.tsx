'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, useUser } from '@/components/AppShell';
import { LintelScore, Beam, CHECK_ORDER } from '@/components/LintelScore';
import { Button, ButtonLink, Panel, PanelHeader, Pill, Spinner, timeAgo } from '@/components/ui';
import { FIX_GUIDE } from '@/lib/scan/fixGuide';
import type { CheckResult } from '@/lib/scan/checks';

type Scan = { id: string; url: string; merchant_id: string | null; status: string; checks: CheckResult[]; score: number; findings: string[]; created_at?: number };

const STATUS = { pass: { label: 'Pass', tone: 'pass' }, partial: { label: 'Partly', tone: 'wait' }, fail: { label: 'Fail', tone: 'fail' } } as const;

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell crumbs={[{ label: 'Stores', href: '/app' }, { label: 'Readiness report' }]}>
      <Report id={id} />
    </AppShell>
  );
}

function Report({ id }: { id: string }) {
  const router = useRouter();
  const user = useUser();
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
    const r = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, scanId: scan.id, merchantId: scan.merchant_id }) });
    const b = await r.json();
    if (!r.ok) { setStarting(''); return setError(b.error ?? 'Couldn’t start the agent.'); }
    router.push(`/app/run/${b.runId}`);
  }

  async function rescan() {
    if (!scan) return;
    setStarting('rescan');
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: scan.url, merchantId: scan.merchant_id }) });
    const b = await r.json();
    if (r.ok) router.push(`/app/scan/${b.scanId}`);
    else { setStarting(''); setError(b.error ?? 'Couldn’t start the scan.'); }
  }

  if (missing)
    return (
      <div className="pt-16">
        <h1 className="t-h2">This report doesn’t exist</h1>
        <p className="mt-2 text-muted">Start a new scan from your stores.</p>
        <ButtonLink href="/app" className="mt-6">Go to your stores</ButtonLink>
      </div>
    );

  if (!scan || scan.status === 'running')
    return (
      <div className="max-w-[720px] pt-12">
        <p className="flex items-center gap-2 text-sm text-muted"><Spinner /> Scanning</p>
        <h1 className="t-h2 mt-3 break-words">{scan?.url ?? 'Your store'}</h1>
        <p className="mt-2 text-muted">Reading your pages, robots.txt and checkout the way an AI agent would. This takes a few seconds.</p>
        <div className="mt-10 flex h-3 gap-1">
          {CHECK_ORDER.map((c, i) => (
            <div key={c} className="pulse-dot basis-0 rounded-[3px] bg-line-strong/70" style={{ flexGrow: [30, 15, 10, 10, 10, 10, 5, 5, 5][i], animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    );

  const visible = scan.checks.filter((c) => c.id !== 'site_unreachable' || c.status === 'fail');
  const order = { fail: 0, partial: 1, pass: 2 } as const;
  const sorted = [...visible].sort((a, b) => order[a.status] - order[b.status]);
  const failing = sorted.filter((c) => c.status !== 'pass');
  const byLintel = failing.filter((c) => FIX_GUIDE[c.id].by === 'lintel').length;
  const byYou = failing.length - byLintel;
  const owned = !!(user && scan.merchant_id);
  const onlyAgentLeft = failing.length === 1 && failing[0].id === 'live_agent';

  return (
    <>
      <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="t-h2">Readiness report</h1>
          <p className="mt-1 truncate text-muted">
            <a href={scan.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{scan.url}</a>
            {scan.created_at ? `, scanned ${timeAgo(scan.created_at)}` : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={rescan} disabled={!!starting}>{starting === 'rescan' && <Spinner />} Scan again</Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] [&>*]:min-w-0">
        <Panel className="p-6 sm:p-8">
          <LintelScore checks={scan.checks} score={scan.score} />
          <h2 className="mt-8 text-[15px] font-semibold">{!failing.length ? 'Nothing is stopping AI agents here' : onlyAgentLeft ? 'One step left: prove an agent can buy' : 'What’s stopping AI agents'}</h2>
          <ul className="mt-3 space-y-3">
            {scan.findings.map((f, i) => (
              <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-2 leading-relaxed text-ink/85">
                <span aria-hidden className={`mt-2 h-1.5 w-1.5 rounded-full ${!failing.length ? 'bg-success' : onlyAgentLeft ? 'bg-warning' : 'bg-danger'}`} />
                {f}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title={failing.length ? `${failing.length} ${failing.length === 1 ? 'thing' : 'things'} to fix` : 'Ready for agents'} sub={failing.length ? `${byLintel} handled by Lintel, ${byYou} need a change on your site` : 'Send an agent to prove it.'} />
            <div className="space-y-3 p-5">
              {!user && (
                <>
                  <p className="text-[15px] leading-relaxed text-soft">Create a free account to fix your store, watch a real agent buy, and get paid through PayPal.</p>
                  <ButtonLink href={`/signup?url=${encodeURIComponent(scan.url)}`} size="lg" className="w-full">Create a free account</ButtonLink>
                  <ButtonLink href={`/login?next=${encodeURIComponent(`/app/scan/${scan.id}`)}`} variant="ghost" className="w-full">I have an account</ButtonLink>
                </>
              )}
              {user && !scan.merchant_id && (
                <>
                  <p className="text-[15px] leading-relaxed text-soft">Add this store to your account to start fixing it.</p>
                  <ButtonLink href={`/app/stores/new?url=${encodeURIComponent(scan.url)}`} size="lg" className="w-full">Add this store</ButtonLink>
                </>
              )}
              {owned && (
                <>
                  <ButtonLink href={`/app/stores/${scan.merchant_id}`} size="lg" className="w-full">{failing.length > 1 ? 'Start setup' : 'Open store'}</ButtonLink>
                  <Button className="w-full" variant="secondary" onClick={() => sendAgent('browser')} disabled={!!starting}>
                    {starting === 'browser' && <Spinner />} Watch an agent try to buy
                  </Button>
                  <Button className="w-full" variant="ghost" onClick={() => sendAgent('headless')} disabled={!!starting}>
                    {starting === 'headless' && <Spinner />} Send an API-only agent
                  </Button>
                </>
              )}
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-6">
        <PanelHeader title="How to fix it" sub="Every check, with what fixes it and who does it." />
        <div className="px-5 pt-5"><Beam checks={scan.checks} className="h-2.5" animate={false} /></div>
        <ul className="mt-3 divide-y divide-line">
          {sorted.map((c) => {
            const earned = c.earned ?? Math.round(c.weight * { pass: 1, partial: 0.5, fail: 0 }[c.status]);
            const fix = FIX_GUIDE[c.id];
            return (
              <li key={c.id} className="grid gap-2 px-5 py-5 sm:grid-cols-[6.5rem_1fr_4rem] sm:gap-4">
                <span><Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill></span>
                <div className="min-w-0">
                  <p className="font-semibold">{c.title}</p>
                  <p className="mt-0.5 break-words text-[15px] text-ink/80">{c.evidence}</p>
                  {c.status !== 'pass' && (
                    <div className={`mt-3 rounded-xl border p-4 ${fix.by === 'lintel' ? 'border-brand/20 bg-brand-wash/60' : 'border-warning/20 bg-warning-wash/60'}`}>
                      <p className={`text-[13px] font-semibold ${fix.by === 'lintel' ? 'text-brand-ink' : 'text-warning'}`}>{fix.by === 'lintel' ? 'Lintel fixes this' : 'Change needed on your site'}</p>
                      <p className="mt-1 font-medium">{fix.title}</p>
                      <p className="mt-1 text-[14.5px] leading-relaxed text-soft">{fix.body}</p>
                      {fix.snippet && <pre className="mt-3 overflow-x-auto rounded-lg bg-night p-3 font-mono text-[12.5px] leading-relaxed text-white/85">{fix.snippet}</pre>}
                    </div>
                  )}
                  {c.status === 'pass' && <p className="mt-1 text-sm text-muted">{c.why}</p>}
                </div>
                <span className="num text-sm text-muted sm:text-right"><span className="font-semibold text-ink">{earned}</span> / {c.weight}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
