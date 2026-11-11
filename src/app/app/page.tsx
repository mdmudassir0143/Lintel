'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, useUser } from '@/components/AppShell';
import { ButtonLink, Panel, Pill, Spinner } from '@/components/ui';
import { scoreState } from '@/components/LintelScore';
import type { StoreCard } from '@/lib/ui/types';

export default function StoresHome() {
  return (
    <AppShell>
      <Stores />
    </AppShell>
  );
}

function Stores() {
  const user = useUser();
  const [stores, setStores] = useState<StoreCard[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch('/api/stores')
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const b = await r.json();
          if (!stop) setStores(b.stores);
        })
        .catch(() => !stop && setError('Couldn’t load your stores. Refresh to try again.'));
    load();
    const t = setInterval(load, 8000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const own = stores?.filter((s) => !s.isDemo) ?? [];
  const demo = stores?.filter((s) => s.isDemo) ?? [];

  return (
    <>
      <div className="flex flex-col gap-4 pt-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="t-h2">{user ? `Welcome, ${firstName(user.name)}` : 'Your stores'}</h1>
          <p className="mt-1 text-muted">Open your stores to AI shopping agents and get paid through PayPal.</p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && <ButtonLink href="/admin" variant="secondary">Admin console</ButtonLink>}
          <ButtonLink href="/app/stores/new">Add a store</ButtonLink>
        </div>
      </div>
      {error && <p className="mt-8 text-danger">{error}</p>}
      {!stores && !error && <p className="mt-10 flex items-center gap-2 text-muted"><Spinner /> Loading your stores</p>}

      {stores && own.length === 0 && (
        <Panel className="mt-8">
          <div className="grid gap-8 p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <h2 className="t-h3">Add your first store</h2>
              <p className="mt-2 max-w-[460px] leading-relaxed text-soft">
                Enter your store’s address. We’ll scan it the way an AI agent reads it, show you what’s blocking agents, and walk you through fixing it.
              </p>
              <ButtonLink href="/app/stores/new" size="lg" className="mt-6">Add a store</ButtonLink>
            </div>
            <ol className="space-y-3 text-[15px]">
              {['Add your store', 'See your agent-readiness score', 'Follow the setup steps', 'Get paid by AI agents through PayPal'].map((t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-wash text-[13px] font-semibold text-brand-ink">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </Panel>
      )}

      {own.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">Your stores</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">{own.map((s) => <StoreTile key={s.id} s={s} />)}</div>
        </section>
      )}

      {demo.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold">Demo store</h2>
          <p className="mt-0.5 text-sm text-muted">A sample coffee shop you can scan, fix and buy from, to see the whole flow.</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">{demo.map((s) => <StoreTile key={s.id} s={s} />)}</div>
        </section>
      )}
    </>
  );
}

/** "Maya Okafor" -> "Maya"; "maya@shop.com" -> "maya". */
function firstName(name: string) {
  return name.split('@')[0].split(/[\s._-]+/)[0] || name;
}

function StoreTile({ s }: { s: StoreCard }) {
  const done = s.setup.filter((x) => x.done).length;
  const next = s.setup.find((x) => !x.done);
  const st = s.latestScore != null ? scoreState(s.latestScore) : null;
  return (
    <Link href={`/app/stores/${s.id}`} className="group block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-ink/25">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold group-hover:text-brand">{s.name}</p>
          <p className="truncate text-sm text-muted">{s.storeUrl}</p>
        </div>
        {st ? <Pill tone={st.tone}>{st.label}</Pill> : <Pill tone="neutral">Not scanned</Pill>}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
        <Stat label="Readiness" value={s.latestScore != null ? `${s.latestScore}` : '—'} suffix="/100" />
        <Stat label="Agent orders" value={`${s.orders}`} />
        <Stat label="Paid" value={`$${s.revenue}`} />
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted">Setup {done} of {s.setup.length}</span>
          <span className="font-medium text-brand">{next ? `Next: ${next.title}` : 'Complete'}</span>
        </div>
        <div className="mt-2 flex gap-1">
          {s.setup.map((x) => <span key={x.id} className={`h-1.5 flex-1 rounded-full ${x.done ? 'bg-brand' : 'bg-line'}`} />)}
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="t-stat mt-1 text-[22px]">
        {value}
        {suffix && <span className="text-[13px] font-medium text-muted">{suffix}</span>}
      </p>
    </div>
  );
}
