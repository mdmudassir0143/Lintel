'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner } from './ui';

/** Store-address form that starts a scan and opens its result in the app. */
export function ScanForm({ size = 'lg', showDemo = true, tone = 'light' }: { size?: 'md' | 'lg'; showDemo?: boolean; tone?: 'light' | 'dark' }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'' | 'mine' | 'demo'>('');
  const [error, setError] = useState('');

  async function scan(target: string, which: 'mine' | 'demo') {
    setBusy(which);
    setError('');
    try {
      const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: target }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? 'Could not start the scan.');
      router.push(`/app/scan/${b.scanId}`);
    } catch (e) {
      setBusy('');
      setError(e instanceof Error ? e.message : 'Could not start the scan.');
    }
  }

  const h = size === 'lg' ? 'h-12' : 'h-10';
  return (
    <div>
      <form
        className="flex max-w-[520px] flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const v = url.trim();
          if (!v) return setError('Enter your store’s address, like yourstore.com');
          scan(/^https?:\/\//i.test(v) ? v : `https://${v}`, 'mine');
        }}
      >
        <label className="sr-only" htmlFor="store-url">Your store’s address</label>
        <input
          id="store-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourstore.com"
          autoComplete="url"
          inputMode="url"
          className={`${h} w-full min-w-0 rounded-lg sm:flex-1 border border-line-strong bg-surface px-4 text-base text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10`}
        />
        <Button type="submit" size={size} variant={tone === 'dark' ? 'dark' : 'primary'} disabled={!!busy}>
          {busy === 'mine' && <Spinner />}
          {busy === 'mine' ? 'Scanning' : 'Scan my store'}
        </Button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {showDemo && (
        <p className={`mt-3 text-sm ${tone === 'dark' ? 'text-white/60' : 'text-muted'}`}>
          Free, no signup. No store handy?{' '}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => scan(`${window.location.origin}/store/ridgeline`, 'demo')}
            className={`font-medium underline decoration-1 underline-offset-4 ${tone === 'dark' ? 'text-white hover:text-white/80' : 'text-ink hover:text-brand'}`}
          >
            {busy === 'demo' ? 'Scanning the demo shop…' : 'Scan our demo coffee shop'}
          </button>
        </p>
      )}
    </div>
  );
}
