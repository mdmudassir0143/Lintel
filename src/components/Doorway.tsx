import { Beam } from './LintelScore';

const OPEN = [
  { id: 'live_agent', weight: 30 }, { id: 'product_jsonld', weight: 15 }, { id: 'server_rendered_prices', weight: 10 },
  { id: 'no_blocking_interstitial', weight: 10 }, { id: 'paypal_checkout', weight: 10 }, { id: 'webmcp_tools', weight: 10 },
  { id: 'robots_allows_ai', weight: 5 }, { id: 'guest_checkout', weight: 5 }, { id: 'agent_checkout', weight: 5 },
].map((s) => ({ ...s, status: 'pass' as const, title: s.id })) as any[];

type Line = { mark: 'ok' | 'wait' | 'goal'; text: React.ReactNode };
const LINES: Line[] = [
  { mark: 'goal', text: <>Buy one 12 oz bag of Ethiopian coffee for under $25</> },
  { mark: 'ok', text: <>Found the store’s 6 agent tools</> },
  { mark: 'ok', text: <><T>search_products</T> “Ethiopian” found Yirgacheffe, 12 oz, $22.00</> },
  { mark: 'ok', text: <><T>add_to_cart</T> RC-ETH12, quantity 1</> },
  { mark: 'wait', text: <><T>checkout_with_paypal</T> answered 402: pay $22.00 with PayPal</> },
  { mark: 'ok', text: <>You approved $22.00 in PayPal</> },
  { mark: 'ok', text: <>Paid. PayPal capture 5MX09897CT3401116</> },
];

function T({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[0.88em] text-basalt">{children}</span>;
}

/** Hero: the lintel sets stone by stone, then the agent walks through the open door. */
export function Doorway() {
  return (
    <div className="relative" aria-label="An AI agent buying coffee through a store that uses Lintel">
      <Beam checks={OPEN} className="h-11 sm:h-14" />
      <div className="mt-[3px] flex gap-[3px] px-[4%]">
        <div className="w-[8%] shrink-0 bg-basalt stone" style={{ animationDelay: '700ms' }} />
        <div className="min-w-0 flex-1 bg-white px-4 pb-6 pt-5 sm:px-7">
          <div className="flex items-center justify-between text-[13px] text-weather">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-patina" aria-hidden />AI agent, shopping</span>
            <span className="hidden sm:inline">Ridgeline Coffee Roasters</span>
          </div>
          <ol className="mt-4 space-y-3 text-[14px] leading-snug text-basalt/80 sm:text-[15px]">
            {LINES.map((l, i) => (
              <li key={i} className="line-in flex gap-3" style={{ animationDelay: `${1000 + i * 380}ms` }}>
                <span aria-hidden className={`mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  l.mark === 'ok' ? 'bg-patina text-white' : l.mark === 'wait' ? 'bg-ochre-wash text-ochre ring-1 ring-ochre/40' : 'bg-basalt text-white'}`}>
                  {l.mark === 'ok' ? '✓' : l.mark === 'wait' ? '$' : '?'}
                </span>
                <span className={l.mark === 'goal' ? 'font-semibold text-basalt' : ''}>{l.text}</span>
              </li>
            ))}
          </ol>
          <div className="line-in mt-6 flex items-center justify-between rounded-md bg-patina-wash px-4 py-3" style={{ animationDelay: `${1000 + LINES.length * 380}ms` }}>
            <span className="text-sm font-semibold text-patina-deep">Order paid through PayPal</span>
            <span className="inscribe num text-xl text-patina-deep">$22.00</span>
          </div>
        </div>
        <div className="w-[8%] shrink-0 bg-basalt stone" style={{ animationDelay: '700ms' }} />
      </div>
      <div className="mx-[1%] h-[3px] bg-basalt/15" aria-hidden />
    </div>
  );
}
