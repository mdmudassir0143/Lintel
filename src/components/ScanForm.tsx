'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner, buttonClass } from './ui';

async function startScan(url: string): Promise<string> {
  const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error ?? 'Could not start the scan.');
  return b.scanId;
}

/** Store-address form that starts a scan and opens its report in the app. */
export function ScanForm({ size = 'lg', tone = 'light', align = 'start' }: { size?: 'md' | 'lg'; tone?: 'light' | 'dark'; align?: 'start' | 'center' }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = url.trim();
    if (!v) return setError('Enter your store’s address, like yourstore.com');
    setBusy(true);
    setError('');
    try {
      router.push(`/app/scan/${await startScan(/^https?:\/\//i.test(v) ? v : `https://${v}`)}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not start the scan.');
    }
  }

  const h = size === 'lg' ? 'h-12' : 'h-10';
  return (
    <div className={`w-full max-w-[520px] ${align === 'center' ? 'mx-auto' : ''}`}>
      <form onSubmit={submit} className={`flex flex-col gap-2 rounded-xl p-1.5 sm:flex-row ${tone === 'dark' ? 'bg-white/10 ring-1 ring-white/15' : 'bg-surface shadow-[var(--shadow-card)]'}`}>
        <label className="sr-only" htmlFor={`store-url-${tone}`}>Your store’s address</label>
        <input
          id={`store-url-${tone}`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourstore.com"
          autoComplete="url"
          inputMode="url"
          className={`${h} w-full min-w-0 rounded-lg bg-transparent px-3.5 text-base outline-none sm:flex-1 ${tone === 'dark' ? 'text-white placeholder:text-white/50' : 'text-ink placeholder:text-muted/70'}`}
        />
        <Button type="submit" size={size} variant={tone === 'dark' ? 'light' : 'primary'} disabled={busy}>
          {busy && <Spinner />} {busy ? 'Scanning' : 'Scan my store'}
        </Button>
      </form>
      {error && <p role="alert" className={`mt-2 text-sm ${tone === 'dark' ? 'text-white' : 'text-danger'} ${align === 'center' ? 'text-center' : ''}`}>{error}</p>}
    </div>
  );
}

/** Runs a scan of the hosted demo store. */
export function DemoButton({ label = 'Try it on a demo store', variant = 'secondary', size = 'lg' }: { label?: string; variant?: 'secondary' | 'ghost' | 'onDark' | 'link'; size?: 'md' | 'lg' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cls = variant === 'link' ? 'inline-flex items-center gap-2 text-[15px] font-medium text-soft underline decoration-line-strong underline-offset-[6px] hover:text-brand hover:decoration-brand disabled:opacity-60' : variant === 'onDark' ? buttonClass('ghost', size, 'text-white hover:bg-white/10') : buttonClass(variant, size);
  return (
    <button
      type="button"
      disabled={busy}
      className={cls}
      onClick={async () => {
        setBusy(true);
        try { router.push(`/app/scan/${await startScan(`${window.location.origin}/store/ridgeline`)}`); } catch { setBusy(false); }
      }}
    >
      {busy && <Spinner />} {busy ? 'Scanning the demo store' : label}
    </button>
  );
}
