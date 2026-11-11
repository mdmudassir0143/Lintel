import type { ReactNode } from 'react';
import { Beam, CHECK_ORDER } from './LintelScore';
import { Mark } from './brand';

const W = [30, 15, 10, 10, 10, 10, 5, 5, 5];
const allPass = CHECK_ORDER.map((id, i) => ({ id, weight: W[i], status: 'pass' as const, title: id }));

export function WindowFrame({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-window)] ${className}`}>
      <div className="flex items-center gap-3 border-b border-line bg-subtle/70 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((d) => <span key={d} className="h-2.5 w-2.5 rounded-full bg-line-strong" />)}</span>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[12.5px] text-muted"><Mark className="h-3 w-3 shrink-0" /> <span className="truncate">{title}</span></span>
        <span className="w-10" aria-hidden />
      </div>
      {children}
    </div>
  );
}

const STEPS: [string, string, string][] = [
  ['Found 6 store tools', 'search_products, add_to_cart, checkout_with_paypal…', '0:03'],
  ['Searched “Ethiopian”', 'Ethiopia Yirgacheffe, 12 oz, $22.00', '0:06'],
  ['Added to cart', 'RC-ETH12, quantity 1', '0:08'],
  ['Checkout answered 402', 'Pay $22.00 with PayPal', '0:14'],
  ['You approved in PayPal', 'Buyer approval received', '0:41'],
  ['Paid', 'PayPal capture 5MX09897CT3401116', '0:44'],
];

/** Hero product shot: an agent run in the Lintel app, end to end. */
export function HeroShot() {
  return (
    <WindowFrame title="Agent run, Ridgeline Coffee Roasters">
      <div className="grid gap-0 md:grid-cols-[1.25fr_1fr]">
        <div className="border-line p-5 sm:p-7 md:border-r">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-wash px-2.5 py-0.5 text-[12.5px] font-medium text-success-ink"><span className="h-1.5 w-1.5 rounded-full bg-success" />Bought</span>
            <span className="text-[12.5px] text-muted">Browser agent</span>
          </div>
          <p className="mt-3 text-[17px] font-semibold tracking-tight">Buy one 12 oz bag of Ethiopian coffee for under $25.</p>
          <ol className="mt-5 space-y-3.5">
            {STEPS.map(([t, d, time], i) => (
              <li key={t} className="line-in grid grid-cols-[1.25rem_1fr_auto] gap-3" style={{ animationDelay: `${300 + i * 220}ms` }}>
                <span aria-hidden className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white ${i === 3 ? 'bg-warning' : i === 5 ? 'bg-success' : 'bg-brand'}`}>{i === 3 ? '$' : '✓'}</span>
                <div className="min-w-0"><p className="text-[14px] font-medium leading-snug">{t}</p><p className="truncate text-[12.5px] text-muted">{d}</p></div>
                <span className="num text-[12px] text-muted">{time}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4 bg-subtle/60 p-5 sm:p-7">
          <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-end justify-between">
              <p className="leading-none"><span className="t-stat text-[40px]">100</span><span className="ml-1 text-sm font-medium text-muted">/100</span></p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-wash px-2.5 py-0.5 text-[12px] font-medium text-success-ink"><span className="h-1.5 w-1.5 rounded-full bg-success" />Open to agents</span>
            </div>
            <Beam checks={allPass} className="mt-4 h-2" delayMs={400} />
            <p className="mt-2.5 text-[12.5px] text-muted">9 of 9 checks pass</p>
          </div>
          <div className="line-in rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]" style={{ animationDelay: '1700ms' }}>
            <p className="text-[12.5px] font-medium text-success-ink">Order paid through PayPal</p>
            <p className="t-stat mt-1 text-[30px]">$22.00</p>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12.5px] text-muted">
              <span>1 × Ethiopia Yirgacheffe</span><span className="num">5MX0…3401116</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong p-3.5 text-[12.5px] text-muted">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paypal text-[11px] font-bold text-paypal-ink">P</span>
            The buyer approved in PayPal. The agent never saw a card or a password.
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

/** The story: a shopper asks an assistant to buy, and the store loses the sale without knowing. */
export function LostSale() {
  return (
    <WindowFrame title="AI assistant">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[14.5px] text-white">
          Buy me a 12 oz bag of Ethiopian coffee, under $25.
        </div>
        <div className="max-w-[92%] space-y-3 text-[14.5px] leading-relaxed text-soft">
          <p>I checked three roasters that carry it:</p>
          <ul className="space-y-2">
            <Shop name="Ridgeline Coffee Roasters" note="Couldn’t read prices, and checkout needs an account" bad />
            <Shop name="Northside Roastery" note="Bots blocked by robots.txt" bad />
            <Shop name="A larger marketplace" note="Found it for $23.50, guest checkout" />
          </ul>
          <p>I bought it from the marketplace. It arrives Thursday.</p>
        </div>
      </div>
    </WindowFrame>
  );
}

function Shop({ name, note, bad }: { name: string; note: string; bad?: boolean }) {
  return (
    <li className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 ${bad ? 'border-danger/15 bg-danger-wash/60' : 'border-success/20 bg-success-wash/70'}`}>
      <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${bad ? 'bg-danger' : 'bg-success'}`}>{bad ? '×' : '✓'}</span>
      <span className="min-w-0"><span className="block text-[14px] font-semibold text-ink">{name}</span><span className="text-[13px] text-muted">{note}</span></span>
    </li>
  );
}
