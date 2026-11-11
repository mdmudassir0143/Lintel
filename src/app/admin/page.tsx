'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { Panel, PanelHeader, Pill, Spinner, timeAgo } from '@/components/ui';
import { scoreState } from '@/components/LintelScore';
import { RUN_STATUS, type RunStatus } from '@/lib/ui/types';

type Overview = {
  totals: { users: number; stores: number; storesLive: number; scans: number; runs: number; runsSucceeded: number; orders: number; revenue: string };
  users: { id: string; email: string; name: string; role: string; createdAt: number; lastLoginAt: number | null; stores: number }[];
  stores: { id: string; name: string; storeUrl: string; installed: boolean; createdAt: number | null; paypalEmail: string | null; installVerifiedAt: number | null; ownerEmail: string | null; score: number | null; orders: number; revenue: string }[];
  runs: { id: string; merchantId: string | null; storeName: string | null; kind: string; status: RunStatus; summary: string | null; createdAt: number; userEmail: string | null }[];
  orders: { id: string; merchantId: string; storeName: string | null; amount: string; paypalOrderId: string; captureId: string; payerEmail: string | null; runId: string | null; createdAt: number }[];
};

const TABS = ['Stores', 'Users', 'Agent runs', 'Orders'] as const;

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number]>('Stores');

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch('/api/admin/overview').then(async (r) => {
        if (r.status === 403) return !stop && setError('This page is for Lintel admins.');
        if (!r.ok) throw new Error();
        const b = await r.json();
        if (!stop) setData(b);
      }).catch(() => !stop && setError('Couldn’t load the admin data.'));
    load();
    const t = setInterval(load, 10000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  return (
    <AppShell crumbs={[{ label: 'Admin' }]}>
      <div className="pt-4">
        <h1 className="t-h2">Admin console</h1>
        <p className="mt-1 text-muted">Every account, store, agent run and payment across Lintel.</p>
      </div>
      {error && <p className="mt-8 rounded-lg bg-danger-wash px-4 py-3 text-danger">{error}</p>}
      {!data && !error && <p className="mt-10 flex items-center gap-2 text-muted"><Spinner /> Loading</p>}
      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Accounts" value={data.totals.users} />
            <Kpi label="Stores" value={data.totals.stores} sub={`${data.totals.storesLive} open to agents`} />
            <Kpi label="Agent runs" value={data.totals.runs} sub={`${data.totals.runsSucceeded} bought`} />
            <Kpi label="Paid through PayPal" value={`$${data.totals.revenue}`} sub={`${data.totals.orders} orders`} />
          </div>

          <div className="mt-8 flex gap-1 border-b border-line" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${tab === t ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
                {t}
              </button>
            ))}
          </div>

          <Panel className="mt-4">
            {tab === 'Stores' && (
              <Table head={['Store', 'Owner', 'Readiness', 'Agent checkout', 'PayPal', 'Orders', 'Paid', 'Added']}>
                {data.stores.map((s) => {
                  const st = s.score != null ? scoreState(s.score) : null;
                  return (
                    <tr key={s.id}>
                      <Td><Link href={`/app/stores/${s.id}`} className="font-semibold hover:text-brand">{s.name}</Link><span className="block max-w-[220px] truncate text-[13px] text-muted">{s.storeUrl}</span></Td>
                      <Td>{s.ownerEmail ?? <span className="text-muted">Demo</span>}</Td>
                      <Td>{st ? <span className="flex items-center gap-2"><span className="num font-semibold">{s.score}</span><Pill tone={st.tone}>{st.label}</Pill></span> : <span className="text-muted">—</span>}</Td>
                      <Td>{s.installed ? <Pill tone="pass">On</Pill> : <Pill tone="neutral">Off</Pill>}</Td>
                      <Td>{s.paypalEmail ?? <span className="text-muted">Not connected</span>}</Td>
                      <Td className="num">{s.orders}</Td>
                      <Td className="num font-semibold">${s.revenue}</Td>
                      <Td className="text-muted">{s.createdAt ? timeAgo(s.createdAt) : '—'}</Td>
                    </tr>
                  );
                })}
              </Table>
            )}
            {tab === 'Users' && (
              <Table head={['Name', 'Email', 'Role', 'Stores', 'Joined', 'Last login']}>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <Td className="font-semibold">{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td>{u.role === 'admin' ? <Pill tone="live">Admin</Pill> : <Pill tone="neutral">Merchant</Pill>}</Td>
                    <Td className="num">{u.stores}</Td>
                    <Td className="text-muted">{timeAgo(u.createdAt)}</Td>
                    <Td className="text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</Td>
                  </tr>
                ))}
              </Table>
            )}
            {tab === 'Agent runs' && (
              <Table head={['When', 'Store', 'Agent', 'Result', 'Started by']}>
                {data.runs.map((r) => (
                  <tr key={r.id}>
                    <Td><Link href={`/app/run/${r.id}`} className="underline decoration-line underline-offset-4 hover:decoration-ink">{timeAgo(r.createdAt)}</Link></Td>
                    <Td>{r.storeName ?? '—'}</Td>
                    <Td>{r.kind === 'browser' ? 'Browser' : 'API'}</Td>
                    <Td><span className="flex items-center gap-2"><Pill tone={RUN_STATUS[r.status].tone}>{RUN_STATUS[r.status].label}</Pill><span className="max-w-[320px] truncate text-[13px] text-muted">{r.summary}</span></span></Td>
                    <Td className="text-muted">{r.userEmail ?? '—'}</Td>
                  </tr>
                ))}
              </Table>
            )}
            {tab === 'Orders' && (
              <Table head={['When', 'Store', 'Amount', 'PayPal order', 'Capture', 'Buyer']}>
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <Td>{o.runId ? <Link href={`/app/run/${o.runId}`} className="underline decoration-line underline-offset-4 hover:decoration-ink">{timeAgo(o.createdAt)}</Link> : timeAgo(o.createdAt)}</Td>
                    <Td>{o.storeName ?? o.merchantId}</Td>
                    <Td className="num font-semibold">${o.amount}</Td>
                    <Td className="num text-muted">{o.paypalOrderId}</Td>
                    <Td className="num text-muted">{o.captureId}</Td>
                    <Td className="text-muted">{o.payerEmail ?? '—'}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Panel className="p-5">
      <p className="t-label">{label}</p>
      <p className="t-stat mt-1">{value}</p>
      {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
    </Panel>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  const rows = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-[14px]">
        <thead className="text-[13px] text-muted">
          <tr className="border-b border-line">{head.map((h) => <th key={h} className="px-5 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {rows === 0 && <p className="px-5 py-8 text-sm text-muted">Nothing here yet.</p>}
    </div>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3 align-top ${className}`}>{children}</td>;
}
