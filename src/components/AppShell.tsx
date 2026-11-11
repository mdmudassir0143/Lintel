'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Wordmark } from './brand';
import { Pill } from './ui';

export type SessionUser = { id: string; email: string; name: string; role: 'merchant' | 'admin' };
const UserCtx = createContext<SessionUser | null>(null);
export const useUser = () => useContext(UserCtx);

export function AppShell({ children, crumbs }: { children: ReactNode; crumbs?: { label: string; href?: string }[] }) {
  const path = usePathname() ?? '';
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((b) => {
      if (b.user) setUser(b.user);
      else if (!path.startsWith('/app/scan')) router.replace(`/login?next=${encodeURIComponent(path)}`);
    }).catch(() => {});
  }, [path, router]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (menu.current && !menu.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const nav = [
    { href: '/app', label: 'Stores', on: path === '/app' || path.startsWith('/app/stores') || path.startsWith('/app/scan') || path.startsWith('/app/run') },
    ...(user?.role === 'admin' ? [{ href: '/admin', label: 'Admin', on: path.startsWith('/admin') }] : []),
    { href: '/docs', label: 'Docs', on: false },
  ];

  return (
    <UserCtx.Provider value={user}>
      <div className="min-h-screen bg-subtle">
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-5 md:px-8">
            <Wordmark href="/app" />
            <nav className="-mb-px flex h-14 items-stretch gap-1 overflow-x-auto text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} aria-current={n.on ? 'page' : undefined}
                  className={`flex items-center whitespace-nowrap border-b-2 px-3 ${n.on ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden sm:inline-flex"><Pill tone="wait">PayPal sandbox</Pill></span>
              {user && (
                <div ref={menu} className="relative">
                  <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu"
                    className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[13px] font-semibold uppercase text-white">
                    {user.name.slice(0, 1)}
                  </button>
                  {open && (
                    <div role="menu" className="absolute right-0 top-10 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-window)]">
                      <div className="px-3 py-2">
                        <p className="truncate text-sm font-semibold">{user.name}</p>
                        <p className="truncate text-[13px] text-muted">{user.email}</p>
                      </div>
                      <div className="my-1 border-t border-line" />
                      <Link role="menuitem" href="/app/stores/new" className="block rounded-lg px-3 py-2 text-sm hover:bg-subtle">Add a store</Link>
                      {user.role === 'admin' && <Link role="menuitem" href="/admin" className="block rounded-lg px-3 py-2 text-sm hover:bg-subtle">Admin console</Link>}
                      <button role="menuitem" onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-wash">Log out</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        {crumbs && (
          <div className="mx-auto max-w-[1240px] px-5 pt-6 text-sm text-muted md:px-8">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="px-2 text-line-strong">/</span>}
                {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span className="text-ink">{c.label}</span>}
              </span>
            ))}
          </div>
        )}
        <main className="mx-auto max-w-[1240px] px-5 pb-24 md:px-8">{children}</main>
      </div>
    </UserCtx.Provider>
  );
}
