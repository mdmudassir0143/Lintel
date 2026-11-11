import type { CheckResult } from '@/lib/scan/checks';

export const CHECK_ORDER = ['live_agent', 'product_jsonld', 'server_rendered_prices', 'no_blocking_interstitial', 'paypal_checkout', 'webmcp_tools', 'robots_allows_ai', 'guest_checkout', 'agent_checkout'] as const;

type Stone = Pick<CheckResult, 'id' | 'weight' | 'status' | 'title'>;

function stoneClass(status: Stone['status']) {
  if (status === 'pass') return 'bg-brand';
  if (status === 'partial') return 'hatch border border-brand text-brand/60';
  return 'border border-dashed border-danger/60 bg-danger-wash';
}

/** The beam: one stone per check, its width set by the check's weight. */
export function Beam({ checks, className = 'h-10', animate = true, delayMs = 0 }: { checks: Stone[]; className?: string; animate?: boolean; delayMs?: number }) {
  const stones = CHECK_ORDER.map((id) => checks.find((c) => c.id === id)).filter(Boolean) as Stone[];
  return (
    <div className={`flex gap-[3px] ${className}`}>
      {stones.map((c, i) => (
        <div
          key={c.id}
          title={`${c.title}: ${c.status}`}
          style={{ flexGrow: c.weight, animationDelay: `${delayMs + i * 70}ms` }}
          className={`min-w-0 basis-0 ${animate ? 'stone' : ''} ${stoneClass(c.status)}`}
        />
      ))}
    </div>
  );
}

export function scoreTone(score: number) {
  return score >= 75 ? 'text-brand' : score >= 40 ? 'text-warning' : 'text-danger';
}

/** The score drawn as a lintel over a doorway, with the number inside the door. */
export function LintelScore({ checks, score }: { checks: CheckResult[]; score: number }) {
  return (
    <figure className="w-full" aria-label={`Agent-readiness score ${score} out of 100`}>
      <Beam checks={checks} className="h-9" />
      <div className="flex justify-between">
        <div className="h-28 w-[9%] bg-subtle-strong" />
        <div className="flex flex-col items-center justify-center pt-3">
          <span className={`headline num text-[76px] leading-none ${scoreTone(score)}`}>{score}</span>
          <span className="mt-1 text-sm text-muted">out of 100</span>
        </div>
        <div className="h-28 w-[9%] bg-subtle-strong" />
      </div>
    </figure>
  );
}
