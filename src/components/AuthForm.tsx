'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from './brand';
import { Button, Spinner } from './ui';

const input = 'h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
          <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
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
