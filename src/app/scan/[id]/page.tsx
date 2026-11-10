'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { LintelScore } from '@/components/LintelScore';
import type { CheckResult } from '@/lib/scan/checks';

type Scan = { id: string; url: string; merchant_id: string | null; status: string; checks: CheckResult[]; score: number; findings: string[] };

const MARK = { pass: '✓', partial: '◐', fail: '✕' } as const;
const MARK_TONE = { pass: 'text-pass', partial: 'text-wait', fail: 'text-fail' } as const;

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [starting, setStarting] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/scan/${id}`);
      if (!r.ok) return setError('This scan does not exist.');
      const s: Scan = await r.json();
      if (!stop) setScan(s);
      if (s.status === 'running' && !stop) setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; };
  }, [id]);

  async function sendAgent(kind: 'browser' | 'headless') {
    if (!scan) return;
    setStarting(kind);
    const r = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, url: scan.url, scanId: scan.id, merchantId: scan.merchant_id }) });
    const b = await r.json();
    if (!r.ok) { setStarting(''); return setError(b.error); }
    router.push(`/run/${b.runId}`);
  }

  async function rescan() {
    if (!scan) return;
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: scan.url }) });
    const b = await r.json();
    if (r.ok) router.push(`/scan/${b.scanId}`);
  }

  if (error) return <Shell><p className="pt-16 text-fail">{error}</p></Shell>;
  if (!scan || scan.status === 'running')
    return (
      <Shell>
        <div className="pt-20">
          <p className="wide text-2xl font-bold">Checking {scan?.url ?? 'your store'}…</p>
          <p className="mt-2 text-ink/60">Reading the pages an AI agent would read. This takes a few seconds.</p>
        </div>
      </Shell>
    );

  const live = scan.checks.find((c) => c.id === 'live_agent');
  return (
    <Shell>
      <p className="pt-6 text-sm text-ink/60">Agent-readiness of <a className="underline underline-offset-4" href={scan.url} target="_blank" rel="noreferrer">{scan.url}</a></p>
      <div className="mt-6 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <LintelScore checks={scan.checks} score={scan.score} />
          <ul className="mt-10 space-y-3">
            {scan.findings.map((f, i) => (
              <li key={i} className="border-l-2 border-ink pl-4 leading-relaxed">{f}</li>
            ))}
          </ul>
        </div>
        <aside className="space-y-4 self-start rounded-lg bg-white p-6">
          <h2 className="wide text-lg font-bold">Send an AI agent to buy</h2>
          <p className="text-sm leading-relaxed text-ink/70">
            {live?.id && live.status !== 'fail' && live.evidence !== 'Not tested yet — run the agent' ? live.evidence : 'The agent gets one goal: buy one 12 oz bag of Ethiopian coffee for under $25. You approve any payment in PayPal.'}
          </p>
          <button onClick={() => sendAgent('browser')} disabled={!!starting} className="w-full rounded-md bg-steel px-4 py-3 font-semibold text-white hover:bg-steel-deep disabled:opacity-60">
            {starting === 'browser' ? 'Starting…' : 'Watch an agent shop in a browser'}
          </button>
          <button onClick={() => sendAgent('headless')} disabled={!!starting} className="w-full rounded-md border border-steel px-4 py-3 font-semibold text-steel hover:bg-steel/5 disabled:opacity-60">
            {starting === 'headless' ? 'Starting…' : 'Send an API-only agent'}
          </button>
          {scan.merchant_id && (
            <Link href={`/merchant/${scan.merchant_id}`} className="block rounded-md bg-ink px-4 py-3 text-center font-semibold text-white hover:bg-ink/90">
              Fix this store with Lintel
            </Link>
          )}
          <button onClick={rescan} className="w-full text-sm text-steel underline underline-offset-4">Scan again</button>
        </aside>
      </div>

      <section className="mt-16">
        <h2 className="wide text-2xl font-bold">What we checked</h2>
        <ul className="mt-6 divide-y divide-mortar/30 border-y border-mortar/30">
          {scan.checks.filter((c) => c.id !== 'site_unreachable' || c.status === 'fail').map((c) => (
            <li key={c.id} className="grid gap-1 py-4 sm:grid-cols-[2rem_1fr_auto] sm:gap-4">
              <span className={`text-lg font-bold ${MARK_TONE[c.status]}`} aria-label={c.status}>{MARK[c.status]}</span>
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-ink/70">{c.evidence}</p>
                <p className="mt-1 text-sm text-ink/50">{c.why}</p>
              </div>
              <span className="num text-sm text-ink/50">{c.earned ?? Math.round(c.weight * { pass: 1, partial: 0.5, fail: 0 }[c.status])}/{c.weight}</span>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
