'use client';
import { use, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ButtonLink, Panel, PanelHeader, Pill, Spinner, buttonClass } from '@/components/ui';
import { RUN_STATUS, type RunStatus } from '@/lib/ui/types';
import { PayPalMark } from '@/components/brand';

type Step = { idx: number; action: string; detail: any; created_at: number };
type Run = { id: string; kind: string; goal: string; status: RunStatus; summary: string | null; scan_id: string | null; merchant_id: string | null; live_view_url: string | null; created_at: number };

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
  request_payment_approval: 'Waited for your approval',
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
    case 'read_page': return `${o.elements?.length ?? 0} things to click on the page`;
    case 'click': {
      const line = String(o.clicked ?? '').split('\n').map((l) => l.trim()).find((l) => /[a-z0-9]/i.test(l));
      return line ? `“${line}”` : '';
    }
    case 'type': return i.text ? `“${i.text}”` : '';
    case 'list_site_tools': return Array.isArray(o.tools) && o.tools.length ? `${o.tools.length} tools: ${o.tools.map((t: any) => t.name).join(', ')}` : 'None found';
    case 'call_site_tool': {
      if (o.products) return `${i.name}: ${o.products.length} ${o.products.length === 1 ? 'match' : 'matches'}${o.products[0] ? `, ${o.products[0].title} ($${o.products[0].price})` : ''}`;
      if (o.ok) return `${i.name}: ${i.args?.sku ?? ''} added`;
      if (o.status === 'approval_required') return `${i.name}: PayPal asked for $${o.amount}`;
      if (o.status === 'paid') return `${i.name}: paid $${o.amount}`;
      return `${i.name}${o.status ? `: ${o.status}` : ''}`;
    }
    case 'find_agent_manifest': return o.found ? 'Found a catalog and a PayPal checkout over HTTP' : o.note ?? 'None found';
    case 'http_get': return `${i.url} (HTTP ${o.status ?? 'error'})`;
    case 'post_checkout': return o.status === 402 ? `402 Payment Required: $${o.amount} with PayPal` : `HTTP ${o.status}`;
    case 'approval_requested': return `$${o.amount} to the store, approved in PayPal`;
    case 'request_payment_approval': return o.approved ? 'You approved it in PayPal' : o.note ?? '';
    case 'pay_with_proof':
    case 'complete_payment': return o.status === 'paid' ? `Paid $${o.amount}. PayPal capture ${o.captureId}` : `HTTP ${o.status ?? ''} ${o.error ?? ''}`;
    case 'finish': return i.summary ?? '';
    default: return '';
  }
}

function stepTone(s: Step): 'ok' | 'bad' | 'pay' | 'plain' {
  const o = s.detail?.output ?? s.detail ?? {};
  if (o?.error) return 'bad';
  if (s.action === 'approval_requested' || s.action === 'request_payment_approval') return 'pay';
  if (o?.status === 'paid' || (s.action === 'finish' && s.detail?.input?.success)) return 'ok';
  if (s.action === 'finish') return 'bad';
  return 'plain';
}

function elapsed(from: number, to: number) {
  const s = Math.max(0, Math.round((to - from) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ run: Run; steps: Step[] } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/run/${id}?screenshots=0`);
      if (!r.ok) return setMissing(true);
      const d = await r.json();
      if (stop) return;
      setData(d);
      if (d.run.status === 'running' || d.run.status === 'awaiting_approval') setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; };
  }, [id]);

  const crumbs = [{ label: 'Stores', href: '/app' }, { label: 'Agent run' }];
  if (missing)
    return (
      <AppShell crumbs={crumbs}>
        <div className="pt-16">
          <h1 className="t-h2">This run doesn’t exist</h1>
          <ButtonLink href="/app" className="mt-6">Go to your stores</ButtonLink>
        </div>
      </AppShell>
    );
  if (!data)
    return <AppShell crumbs={crumbs}><p className="flex items-center gap-2 pt-12 text-muted"><Spinner /> Loading the run</p></AppShell>;

  const { run } = data;
  const steps = data.steps.filter((s) => s.action !== 'error');
  const approval = [...steps].reverse().find((s) => s.action === 'approval_requested')?.detail;
  const active = run.status === 'running' || run.status === 'awaiting_approval';
  const shotActions = new Set(['goto', 'click', 'type', 'call_site_tool', 'complete_payment']);
  const lastShot = steps.filter((s) => shotActions.has(s.action)).at(-1)?.idx;
  const paid = steps.find((s) => (s.action === 'pay_with_proof' || s.action === 'complete_payment' || s.action === 'call_site_tool') && s.detail?.output?.status === 'paid')?.detail?.output;
  const st = RUN_STATUS[run.status];

  return (
    <AppShell crumbs={crumbs}>
      <div className="pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={st.tone}>{st.label}</Pill>
          <span className="text-sm text-muted">{run.kind === 'browser' ? 'Browser agent' : 'API-only agent'}</span>
        </div>
        <h1 className="t-h2 mt-3 max-w-[860px]">{run.goal}</h1>
      </div>

      <div aria-live="polite">
        {run.status === 'awaiting_approval' && approval && (
          <Panel className="mt-6 border-warning/40">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-warning">The agent is at checkout</p>
                <p className="t-h2 mt-1">Approve <span className="num">${approval.amount}</span> in PayPal</p>
                <p className="mt-1 max-w-[560px] text-[15px] text-muted">Nothing is charged until you approve. Log in with the sandbox buyer account, press Pay, and the agent finishes the purchase.</p>
              </div>
              <a href={approval.approveUrl} target="_blank" rel="noreferrer" className={buttonClass('primary', 'lg', 'shrink-0')}><PayPalMark className="h-4 w-4" /> Approve in PayPal</a>
            </div>
          </Panel>
        )}
        {paid && (
          <Panel className="mt-6 border-success/30 bg-success-wash">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-success-ink">Order paid through PayPal</p>
                <p className="t-stat mt-1 text-success-ink">${paid.amount}</p>
                <p className="num mt-2 break-all text-sm text-ink/70">PayPal order {paid.paypalOrderId}, capture {paid.captureId}</p>
              </div>
              {run.merchant_id && <ButtonLink href={`/app/stores/${run.merchant_id}`} variant="secondary">See it in the store’s orders</ButtonLink>}
            </div>
          </Panel>
        )}
        {run.status === 'failed' && (
          <Panel className="mt-6 border-danger/30 bg-danger-wash">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-danger">The agent couldn’t buy</p>
                <p className="mt-1 max-w-[640px] text-ink/80">{run.summary}</p>
              </div>
              {run.merchant_id && <ButtonLink href={`/app/stores/${run.merchant_id}`} variant="dark">Fix this store</ButtonLink>}
            </div>
          </Panel>
        )}
        {run.status === 'succeeded' && !paid && run.summary && (
          <Panel className="mt-6 p-6"><p className="font-semibold text-success-ink">{run.summary}</p></Panel>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="self-start">
          <PanelHeader title="What the agent did" sub={`${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`} />
          <ol className="px-5 py-2">
            {steps.map((s, i) => {
              const tone = stepTone(s);
              return (
                <li key={s.idx} className="relative grid grid-cols-[1.5rem_1fr_auto] gap-3 py-3">
                  {i < steps.length - 1 && <span aria-hidden className="absolute left-[11px] top-9 h-[calc(100%-1.5rem)] w-px bg-line" />}
                  <span aria-hidden className={`relative mt-0.5 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                    tone === 'ok' ? 'bg-success text-white' : tone === 'bad' ? 'bg-danger-wash text-danger' : tone === 'pay' ? 'bg-warning-wash text-warning' : 'border border-line bg-white text-muted'}`}>
                    {tone === 'ok' ? '✓' : tone === 'bad' ? '!' : tone === 'pay' ? '$' : s.idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{LABEL[s.action] ?? s.action}</p>
                    <p className="break-words text-[14px] leading-relaxed text-muted">{describe(s)}</p>
                  </div>
                  <span className="num pt-0.5 text-[13px] text-muted/80">{elapsed(run.created_at, s.created_at)}</span>
                </li>
              );
            })}
            {active && (
              <li className="flex items-center gap-3 py-3 pl-0.5 text-sm text-muted">
                <Spinner className="h-5 w-5" /> {run.status === 'awaiting_approval' ? 'Waiting for your approval' : 'Thinking about the next step'}
              </li>
            )}
          </ol>
        </Panel>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {run.kind === 'browser' ? (
            <Panel className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((d) => <span key={d} className="h-2.5 w-2.5 rounded-full bg-subtle-strong" />)}</span>
                <span className="min-w-0 flex-1 truncate rounded bg-subtle px-3 py-1 text-[13px] text-muted">
                  {steps.find((s) => s.action === 'goto')?.detail?.output?.url ?? 'Starting browser'}
                </span>
                {active && run.live_view_url ? <Pill tone="live">Live</Pill> : null}
              </div>
              {active && run.live_view_url ? (
                <iframe src={run.live_view_url} title="Live view of the agent’s browser" className="aspect-[16/10] w-full bg-white" />
              ) : lastShot !== undefined ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/run/${id}/step/${lastShot}`} alt="What the agent saw at its latest step" className="w-full bg-white" />
              ) : (
                <div className="grid aspect-[16/10] place-items-center bg-subtle text-sm text-muted"><span className="flex items-center gap-2"><Spinner /> Opening a browser</span></div>
              )}
            </Panel>
          ) : (
            <Panel className="p-6">
              <p className="font-semibold">No browser involved</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">This agent shops over HTTP only, the way AI assistants call APIs: it reads the store’s agent manifest, then pays through the x402 checkout.</p>
            </Panel>
          )}
          {!active && run.scan_id && (
            <ButtonLink href={`/app/scan/${run.scan_id}`} variant="dark" className="w-full">See the updated score</ButtonLink>
          )}
        </div>
      </div>
    </AppShell>
  );
}
