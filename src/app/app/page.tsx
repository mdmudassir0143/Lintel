'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ScanForm } from '@/components/ScanForm';
import { Panel, PanelHeader, Pill, ButtonLink, timeAgo } from '@/components/ui';
import { scoreTone } from '@/components/LintelScore';
import { RUN_STATUS, type StoreSummary } from '@/lib/ui/types';

const STORE_ID = 'ridgeline';

export default function Overview() {
  const [data, setData] = useState<StoreSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`/api/merchant/${STORE_ID}/orders`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => !stop && setData(d))
        .catch(() => !stop && setFailed(true));
    load();
    const t = setInterval(load, 6000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const latest = data?.scans[0];
  const revenue = data ? data.orders.reduce((s, o) => s + Number(o.amount), 0) : 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-8 pt-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="inscribe text-[34px] leading-tight">Overview</h1>
          <p className="mt-1 text-weather">Scan any store, or manage the stores you’ve opened to AI agents.</p>
        </div>
        <div className="lg:w-[520px]"><ScanForm size="md" showDemo={false} /></div>
      </div>

      {failed && <p className="mt-8 text-oxide">Couldn’t load your stores. Refresh to try again.</p>}

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold">Your stores</h2>
        <Panel className="mt-3">
          {!data ? (
            <div className="h-[120px] animate-pulse" />
          ) : (
            <div className="grid gap-6 p-5 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center">
              <div className="min-w-0">
                <Link href={`/app/stores/${STORE_ID}`} className="text-[17px] font-semibold hover:text-patina">{data.merchant.name}</Link>
                <p className="truncate text-sm text-weather">{data.merchant.storeUrl}</p>
              </div>
              <Stat label="Agent access">
                {data.merchant.installed ? <Pill tone="pass">Open to agents</Pill> : <Pill tone="fail">Closed to agents</Pill>}
              </Stat>
              <Stat label="Readiness">
                {latest ? <span className={`inscribe num text-2xl ${scoreTone(latest.score)}`}>{latest.score}</span> : <span className="text-weather">Not scanned</span>}
              </Stat>
              <Stat label="Paid by agents">
                <span className="inscribe num text-2xl">${revenue.toFixed(2)}</span>
                <span className="ml-1.5 text-sm text-weather">{data.orders.length} {data.orders.length === 1 ? 'order' : 'orders'}</span>
              </Stat>
              <ButtonLink href={`/app/stores/${STORE_ID}`} variant="secondary">Manage</ButtonLink>
            </div>
          )}
        </Panel>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel>
          <PanelHeader title="Recent scans" sub="Each scan reads the store the way an AI agent would." />
          {data && data.scans.length === 0 && <Empty>No scans yet. Enter a store address above to run the first one.</Empty>}
          <ul className="divide-y divide-joint">
            {data?.scans.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`/app/scan/${s.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-plaster/60">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{data.merchant.name}</span>
                    <span className="text-sm text-weather">{timeAgo(s.created_at)}</span>
                  </span>
                  <span className={`inscribe num text-xl ${scoreTone(s.score)}`}>{s.score}<span className="text-sm font-medium text-weather"> /100</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Agent runs" sub="Every time an AI agent tried to buy, and how it went." />
          {data && data.runs.length === 0 && <Empty>No agents sent yet. Open a scan and send one to buy.</Empty>}
          <ul className="divide-y divide-joint">
            {data?.runs.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link href={`/app/run/${r.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-plaster/60">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{r.summary ?? r.goal}</span>
                    <span className="text-sm text-weather">{r.kind === 'browser' ? 'Browser agent' : 'API agent'}, {timeAgo(r.created_at)}</span>
                  </span>
                  <Pill tone={RUN_STATUS[r.status].tone}>{RUN_STATUS[r.status].label}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-weather">{label}</p>
      <div className="mt-1 flex items-baseline">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-sm text-weather">{children}</p>;
}
