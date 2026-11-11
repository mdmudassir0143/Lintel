'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Wordmark } from './brand';
import { Pill } from './ui';

const NAV = [
  { href: '/app', label: 'Overview', match: (p: string) => p === '/app' || p.startsWith('/app/scan') || p.startsWith('/app/run') },
  { href: '/app/stores/ridgeline', label: 'Ridgeline Coffee', match: (p: string) => p.startsWith('/app/stores') },
  { href: '/docs', label: 'Docs', match: (p: string) => p.startsWith('/docs') },
];

export function AppShell({ children, crumbs }: { children: ReactNode; crumbs?: { label: string; href?: string }[] }) {
  const path = usePathname() ?? '';
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-joint bg-white">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-5 md:px-8">
          <Wordmark href="/app" />
          <nav className="-mb-px flex h-14 items-stretch gap-1 overflow-x-auto text-sm">
            {NAV.map((n) => {
              const on = n.match(path);
              return (
                <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined}
                  className={`flex items-center whitespace-nowrap border-b-2 px-3 ${on ? 'border-basalt font-semibold text-basalt' : 'border-transparent text-weather hover:text-basalt'}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <Pill tone="wait">PayPal sandbox</Pill>
          </div>
        </div>
      </header>
      {crumbs && (
        <div className="mx-auto max-w-[1240px] px-5 pt-6 text-sm text-weather md:px-8">
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="px-2 text-joint">/</span>}
              {c.href ? <Link href={c.href} className="hover:text-basalt">{c.label}</Link> : <span className="text-basalt">{c.label}</span>}
            </span>
          ))}
        </div>
      )}
      <main className="mx-auto max-w-[1240px] px-5 pb-24 md:px-8">{children}</main>
    </div>
  );
}
