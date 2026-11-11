'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Button, Panel, Spinner } from '@/components/ui';
import { ShopifyMark } from '@/components/brand';

const input = 'h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10';

export default function NewStorePage() {
  return (
    <AppShell crumbs={[{ label: 'Stores', href: '/app' }, { label: 'Add a store' }]}>
      <Suspense>
        <NewStoreForm />
      </Suspense>
    </AppShell>
  );
}

function NewStoreForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [shopify, setShopify] = useState(false);
  useEffect(() => {
    fetch('/api/auth/providers').then((r) => r.json()).then((p) => setShopify(!!p.shopify)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch('/api/stores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      return setError(b.error ?? 'Couldn’t add the store. Try again.');
    }
    router.push(`/app/scan/${b.scanId}`);
  }

  return (
    <div className="mx-auto max-w-[620px] pt-10">
      <h1 className="t-h2">Add a store</h1>
      <p className="mt-2 text-soft">We’ll scan it right away and show you what stops AI agents from buying.</p>
      {shopify && (
        <Panel className="mt-8">
          <form action="/api/auth/shopify" method="get" className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
            <ShopifyMark className="h-8 w-8 shrink-0 text-[#5e8e3e]" />
            <div className="flex-1">
              <p className="font-semibold">On Shopify? Connect in one step</p>
              <p className="text-sm text-muted">Imports your products and adds Lintel to your storefront. No code.</p>
            </div>
            <input name="shop" required placeholder="your-store.myshopify.com" aria-label="Shopify store address" className={`${input} sm:w-60`} />
            <Button type="submit">Connect</Button>
          </form>
        </Panel>
      )}
      <Panel className="mt-6">
        <form onSubmit={submit} className="space-y-5 p-6">
          <label className="block">
            <span className="text-sm font-medium">Store name</span>
            <input name="name" required maxLength={80} placeholder="Ridge & Bean Coffee" className={`${input} mt-1.5`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Store address</span>
            <input name="url" required defaultValue={params.get('url') ?? ''} placeholder="yourstore.com" inputMode="url" className={`${input} mt-1.5`} />
            <span className="mt-1.5 block text-[13px] text-muted">The homepage AI agents land on.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">PayPal business email <span className="font-normal text-muted">(optional, you can add it later)</span></span>
            <input name="paypalEmail" type="email" placeholder="payments@yourstore.com" className={`${input} mt-1.5`} />
            <span className="mt-1.5 block text-[13px] text-muted">Agent purchases are paid straight into this PayPal account.</span>
          </label>
          {error && <p role="alert" className="rounded-lg bg-danger-wash px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
            <Button type="button" variant="ghost" onClick={() => router.push('/app')}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Spinner />} Add store and scan</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
