import type { CheckResult } from '@/lib/scan/checks';

const ORDER = ['live_agent', 'product_jsonld', 'server_rendered_prices', 'no_blocking_interstitial', 'paypal_checkout', 'webmcp_tools', 'robots_allows_ai', 'guest_checkout', 'agent_checkout'];

/** The score drawn as a lintel: one stone per check, width = weight; posts below form the doorway. */
export function LintelScore({ checks, score, size = 'lg' }: { checks: CheckResult[]; score: number; size?: 'lg' | 'sm' }) {
  const stones = ORDER.map((id) => checks.find((c) => c.id === id)).filter(Boolean) as CheckResult[];
  const tone = score >= 75 ? 'text-pass' : score >= 40 ? 'text-wait' : 'text-fail';
  const h = size === 'lg' ? 'h-10' : 'h-5';
  return (
    <figure className="w-full" aria-label={`Agent-readiness score ${score} out of 100`}>
      <div className={`flex gap-[3px] ${h}`}>
        {stones.map((c, i) => (
          <div
            key={c.id}
            title={`${c.title}: ${c.status}`}
            style={{ flexGrow: c.weight, animationDelay: `${i * 70}ms` }}
            className={`stone basis-0 rounded-[2px] ${
              c.status === 'pass' ? 'bg-ink' : c.status === 'partial' ? 'hatch border border-ink' : 'border border-dashed border-fail/70 bg-fail/5'
            }`}
          />
        ))}
      </div>
      {size === 'lg' && (
        <div className="flex justify-between">
          <div className="h-24 w-[10%] bg-stone-deep" />
          <div className="flex flex-col items-center justify-center pt-4">
            <span className={`wide num text-7xl font-extrabold leading-none ${tone}`}>{score}</span>
            <span className="mt-1 text-sm text-ink/60">out of 100</span>
          </div>
          <div className="h-24 w-[10%] bg-stone-deep" />
        </div>
      )}
    </figure>
  );
}
