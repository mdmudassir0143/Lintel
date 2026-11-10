'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';

type Step = { idx: number; action: string; detail: any; created_at: number };
type Run = { id: string; kind: string; goal: string; status: 'running' | 'awaiting_approval' | 'succeeded' | 'failed'; summary: string | null; scan_id: string | null; live_view_url: string | null };

const LABEL: Record<string, string> = {
  goto: 'Opened the store',
  read_page: 'Read the page',
  click: 'Clicked',
  type: 'Typed',
  list_site_tools: 'Looked for agent tools',
  call_site_tool: 'Used a store tool',
  find_agent_manifest: 'Looked for an agent manifest',
  http_get: 'Fetched a page',
  post_checkout: 'Started checkout',
  approval_requested: 'Asked you to approve the payment',
  request_payment_approval: 'Payment approval',
  pay_with_proof: 'Paid with the PayPal proof',
  complete_payment: 'Paid with the PayPal proof',
  finish: 'Finished',
};

function describe(s: Step): string {
  const i = s.detail?.input ?? {};
  const o = s.detail?.output ?? s.detail ?? {};
  if (o?.error) return o.error;
  switch (s.action) {
    case 'goto': return o.title ?? i.url ?? '';
    case 'read_page': return `${o.elements?.length ?? 0} things to click on ${o.url ?? ''}`;
    case 'click': {
      const line = String(o.clicked ?? '').split('\n').map((l) => l.trim()).find((l) => /[a-z0-9]/i.test(l));
      return line ? `“${line}”` : '';
    }
    case 'list_site_tools': return Array.isArray(o.tools) ? o.tools.map((t: any) => t.name).join(', ') : 'None found';
    case 'call_site_tool': return `${i.name}${o.status ? ` → ${o.status}` : ''}${o.products ? ` → ${o.products.length} products` : ''}${o.ok ? ' → added' : ''}`;
    case 'find_agent_manifest': return o.found ? 'Found: catalog + PayPal checkout over HTTP' : o.note ?? 'None found';
    case 'http_get': return `${i.url} (HTTP ${o.status ?? '—'})`;
    case 'post_checkout': return o.status === 402 ? `402 Payment Required: $${o.amount} via PayPal` : `HTTP ${o.status}`;
    case 'approval_requested': return `$${o.amount} to the store, in PayPal`;
    case 'request_payment_approval': return o.approved ? 'Approved in PayPal' : o.note ?? '';
    case 'pay_with_proof':
    case 'complete_payment': return o.status === 'paid' ? `Paid $${o.amount} · PayPal capture ${o.captureId}` : `HTTP ${o.status ?? ''} ${o.error ?? ''}`;
    case 'finish': return i.summary ?? '';
    default: return '';
  }
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ run: Run; steps: Step[] } | null>(null);
  const [shotsWith, setShotsWith] = useState<number[]>([]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/run/${id}?screenshots=0`);
      if (!r.ok) return;
      const d = await r.json();
      if (stop) return;
      setData(d);
      if (d.run.status === 'running' || d.run.status === 'awaiting_approval') setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const shotActions = new Set(['goto', 'click', 'type', 'call_site_tool', 'complete_payment']);
    setShotsWith(data.steps.filter((s) => shotActions.has(s.action)).map((s) => s.idx));
  }, [data]);

  if (!data) return <Shell><p className="pt-16">Loading run…</p></Shell>;
  const { run, steps } = data;
  const approval = [...steps].reverse().find((s) => s.action === 'approval_requested')?.detail;
  const active = run.status === 'running' || run.status === 'awaiting_approval';
  const lastShot = shotsWith.at(-1);
  const paid = steps.find((s) => (s.action === 'pay_with_proof' || s.action === 'complete_payment') && s.detail?.output?.status === 'paid')?.detail?.output;

  return (
    <Shell>
      <div className="pt-6">
        <p className="text-sm text-ink/60">{run.kind === 'browser' ? 'Browser agent' : 'API-only agent'}</p>
        <h1 className="wide mt-1 max-w-3xl text-3xl font-extrabold leading-tight">{run.goal}</h1>
        <p className="mt-3" aria-live="polite">
          {run.status === 'running' && <span className="text-steel">The agent is working…</span>}
          {run.status === 'awaiting_approval' && <span className="font-semibold text-wait">Waiting for your approval in PayPal</span>}
          {run.status === 'succeeded' && <span className="font-semibold text-pass">Bought. {run.summary}</span>}
          {run.status === 'failed' && <span className="font-semibold text-fail">Couldn&apos;t buy. {run.summary}</span>}
        </p>
      </div>

      {run.status === 'awaiting_approval' && approval && (
        <div className="mt-6 flex flex-col gap-4 rounded-lg border-2 border-wait bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="wide text-xl font-bold">Your agent wants to pay <span className="num">${approval.amount}</span></p>
            <p className="text-sm text-ink/70">Nothing is charged until you approve in PayPal. The agent continues once you do.</p>
          </div>
          <a href={approval.approveUrl} target="_blank" rel="noreferrer" className="rounded-md bg-[#ffc439] px-6 py-3 text-center font-bold text-[#003087] hover:brightness-95">
            Approve in PayPal
          </a>
        </div>
      )}

      {paid && (
        <div className="mt-6 rounded-lg bg-pass/10 p-6">
          <p className="wide text-xl font-bold text-pass">Paid <span className="num">${paid.amount}</span> through PayPal</p>
          <p className="num mt-1 text-sm text-ink/70">PayPal order {paid.paypalOrderId} · capture {paid.captureId}</p>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.15fr]">
        <ol className="space-y-4">
          {steps.map((s) => (
            <li key={s.idx} className="grid grid-cols-[2rem_1fr] gap-2">
              <span className="num pt-0.5 text-sm text-ink/40">{s.idx + 1}</span>
              <div className="min-w-0">
                <p className="font-semibold">{LABEL[s.action] ?? s.action}</p>
                <p className="break-words text-sm text-ink/70">{describe(s)}</p>
              </div>
            </li>
          ))}
          {active && <li className="pl-10 text-sm text-ink/50">…</li>}
        </ol>
        <div className="space-y-3 self-start lg:sticky lg:top-6">
          {active && run.live_view_url ? (
            <iframe src={run.live_view_url} title="Live view of the agent's browser" className="aspect-[16/10] w-full rounded-lg border border-mortar/40 bg-white" />
          ) : lastShot !== undefined ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/run/${id}/step/${lastShot}`} alt="What the agent saw at its latest step" className="w-full rounded-lg border border-mortar/40 bg-white" />
          ) : run.kind === 'headless' ? (
            <p className="rounded-lg bg-white p-6 text-sm text-ink/60">This agent shops over HTTP only, the way AI assistants call APIs. No browser is involved.</p>
          ) : null}
          {!active && run.scan_id && (
            <Link href={`/scan/${run.scan_id}`} className="inline-block text-steel underline underline-offset-4">See the updated score</Link>
          )}
        </div>
      </div>
    </Shell>
  );
}
