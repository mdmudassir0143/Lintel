import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'paypal';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-patina text-white hover:bg-patina-deep',
  dark: 'bg-basalt text-white hover:bg-basalt-soft',
  secondary: 'border border-joint bg-white text-basalt hover:border-weather/50',
  ghost: 'text-basalt hover:bg-basalt/5',
  paypal: 'bg-[#ffc439] text-[#003087] hover:brightness-95',
};
const SIZE = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-[15px]', lg: 'h-12 px-6 text-base' } as const;

export function buttonClass(variant: Variant = 'primary', size: keyof typeof SIZE = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors disabled:pointer-events-none disabled:opacity-55 ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export function Button({ variant = 'primary', size = 'md', className = '', ...p }: ComponentProps<'button'> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return <button {...p} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant = 'primary', size = 'md', className = '', ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return <Link {...p} className={buttonClass(variant, size, className)} />;
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type Tone = 'pass' | 'fail' | 'wait' | 'neutral' | 'live';
const TONE: Record<Tone, string> = {
  pass: 'bg-patina-wash text-patina-deep',
  fail: 'bg-oxide-wash text-oxide',
  wait: 'bg-ochre-wash text-ochre',
  neutral: 'bg-plaster-deep text-weather',
  live: 'bg-patina-wash text-patina-deep',
};
const DOT: Record<Tone, string> = { pass: 'bg-patina', fail: 'bg-oxide', wait: 'bg-ochre', neutral: 'bg-weather', live: 'bg-patina pulse-dot' };

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium ${TONE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

export function Panel({ className = '', children, ...p }: ComponentProps<'section'>) {
  const bg = /(^|\s)bg-/.test(className) ? '' : 'bg-white';
  const border = /(^|\s)border-(?!t|b|l|r|x|y)[a-z]/.test(className) ? '' : 'border-joint';
  return <section {...p} className={`rounded-[10px] border ${border} ${bg} ${className}`}>{children}</section>;
}

export function PanelHeader({ title, action, sub }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-joint px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-weather">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Code({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <code className={`rounded bg-plaster-deep px-1.5 py-0.5 font-mono text-[0.85em] ${className}`}>{children}</code>;
}

export function timeAgo(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
