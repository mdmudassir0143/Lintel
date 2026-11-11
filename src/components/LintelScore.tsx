import type { CheckResult } from '@/lib/scan/checks';
import { Pill } from './ui';

export const CHECK_ORDER = ['live_agent', 'product_jsonld', 'server_rendered_prices', 'no_blocking_interstitial', 'paypal_checkout', 'webmcp_tools', 'robots_allows_ai', 'guest_checkout', 'agent_checkout'] as const;

type Stone = Pick<CheckResult, 'id' | 'weight' | 'status' | 'title'>;

function stoneClass(status: Stone['status']) {
  if (status === 'pass') return 'bg-brand';
  if (status === 'partial') return 'bg-brand/35';
  return 'bg-line-strong/70';
}

/** The beam: one segment per check, as wide as the check's points. */
export function Beam({ checks, className = 'h-2.5', animate = true, delayMs = 0 }: { checks: Stone[]; className?: string; animate?: boolean; delayMs?: number }) {
  const stones = CHECK_ORDER.map((id) => checks.find((c) => c.id === id)).filter(Boolean) as Stone[];
  return (
    <div className={`flex gap-1 ${className}`}>
      {stones.map((c, i) => (
        <div
          key={c.id}
          title={`${c.title}: ${c.status}`}
          style={{ flexGrow: c.weight, animationDelay: `${delayMs + i * 60}ms` }}
          className={`min-w-0 basis-0 rounded-[3px] ${animate ? 'stone' : ''} ${stoneClass(c.status)}`}
        />
      ))}
    </div>
  );
}

export function scoreState(score: number): { label: string; tone: 'pass' | 'wait' | 'fail' } {
  if (score >= 90) return { label: 'Open to agents', tone: 'pass' };
  if (score >= 40) return { label: 'Almost there', tone: 'wait' };
  return { label: 'Closed to agents', tone: 'fail' };
}

/** Kept for lists: the score number stays ink; color lives in the status pill. */
export function scoreTone(_score: number) {
  return 'text-ink';
}

export function LintelScore({ checks, score }: { checks: CheckResult[]; score: number }) {
  const st = scoreState(score);
  const visible = checks.filter((c) => c.id !== 'site_unreachable');
  const passing = visible.filter((c) => c.status === 'pass').length;
  return (
    <figure className="w-full" aria-label={`Agent-readiness score ${score} out of 100`}>
      <div className="flex items-end justify-between gap-4">
        <p className="leading-none">
          <span className="t-stat text-[64px] tracking-[-0.05em]">{score}</span>
          <span className="ml-1 text-lg font-medium text-muted">/100</span>
        </p>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      <Beam checks={checks} className="mt-5 h-3" />
      <figcaption className="mt-3 text-sm text-muted">{passing} of {visible.length} checks pass</figcaption>
    </figure>
  );
}
