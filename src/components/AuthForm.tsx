'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark, GoogleMark, ShopifyMark } from './brand';
import { Button, Spinner } from './ui';

const input = 'h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10';

export function AuthForm({ mode, providers }: { mode: 'login' | 'signup'; providers: { google: boolean; shopify: boolean } }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [shopOpen, setShopOpen] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      return setError(b.error ?? 'Something went wrong. Try again.');
    }
    const storeUrl = params.get('url');
    router.push(mode === 'signup' && storeUrl ? `/app/stores/new?url=${encodeURIComponent(storeUrl)}` : safeNext);
    router.refresh();
  }

  const signup = mode === 'signup';
  return (
    <div className="flex min-h-screen flex-col bg-subtle">
      <header className="px-5 py-5 md:px-8"><Wordmark /></header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[400px]">
          <h1 className="t-h2">{signup ? 'Create your account' : 'Log in to Lintel'}</h1>
          <p className="mt-2 text-soft">{signup ? 'Add your store, see what AI agents see, and fix it.' : 'Welcome back.'}</p>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          {(providers.google || providers.shopify) && (
            <div className="space-y-2.5">
              {providers.google && (
                <a href={`/api/auth/google?next=${encodeURIComponent(safeNext)}`} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface text-[15px] font-semibold hover:bg-subtle">
                  <GoogleMark className="h-[18px] w-[18px]" /> Continue with Google
                </a>
              )}
              {providers.shopify && !shopOpen && (
                <button type="button" onClick={() => setShopOpen(true)} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface text-[15px] font-semibold hover:bg-subtle">
                  <ShopifyMark className="h-[18px] w-[18px] text-[#5e8e3e]" /> Continue with Shopify
                </button>
              )}
              {providers.shopify && shopOpen && (
                <form action="/api/auth/shopify" method="get" className="rounded-lg border border-line-strong p-3">
                  <label className="text-sm font-medium" htmlFor="shop">Your Shopify store</label>
                  <div className="mt-1.5 flex gap-2">
                    <input id="shop" name="shop" required autoFocus placeholder="your-store.myshopify.com" className={`${input} h-10`} />
                    <Button type="submit"><ShopifyMark className="h-4 w-4" /> Connect</Button>
                  </div>
                  <p className="mt-2 text-[13px] text-muted">We’ll create your account, import your products and add Lintel to your store.</p>
                </form>
              )}
              <div className="flex items-center gap-3 py-2 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            {signup && (
              <label className="block">
                <span className="text-sm font-medium">Your name</span>
                <input name="name" required autoComplete="name" className={`${input} mt-1.5`} />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium">Work email</span>
              <input name="email" type="email" required autoComplete="email" className={`${input} mt-1.5`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input name="password" type="password" required minLength={signup ? 8 : undefined} autoComplete={signup ? 'new-password' : 'current-password'} className={`${input} mt-1.5`} />
              {signup && <span className="mt-1.5 block text-[13px] text-muted">At least 8 characters.</span>}
            </label>
            {error && <p role="alert" className="rounded-lg bg-danger-wash px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />} {signup ? 'Create account' : 'Log in'}
            </Button>
          </form>
          </div>
          <p className="mt-6 text-center text-sm text-soft">
            {signup ? 'Already have an account? ' : 'New to Lintel? '}
            <Link href={`${signup ? '/login' : '/signup'}${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand hover:text-brand-hover">
              {signup ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
