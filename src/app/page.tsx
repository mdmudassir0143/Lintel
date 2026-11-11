import type { ReactNode } from 'react';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { ScanForm } from '@/components/ScanForm';
import { Doorway } from '@/components/Doorway';
import { Beam } from '@/components/LintelScore';
import { ButtonLink } from '@/components/ui';
import { CHECK_META } from '@/lib/scan/checks';
import { CHECK_ORDER } from '@/components/LintelScore';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { absolute: 'Lintel: let AI agents buy from your store' },
  description: 'Lintel finds what stops AI shopping agents at your store, fixes it with one script tag, and settles every agent purchase through PayPal.',
};

const snippet = (base: string) => `<script src="${base}/lintel.js"
  data-merchant="your-store" async></script>
<link rel="agent-manifest"
  href="${base}/m/your-store/agent/manifest.json">`;

const RESPONSE_402 = `HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Mi...

{
  "x402Version": 2,
  "accepts": [{
    "scheme": "paypal-order",
    "network": "paypal:sandbox",
    "amount": "22.00",
    "asset": "USD",
    "payTo": "ridgeline",
    "extra": {
      "orderId": "5WD64056U3651162B",
      "approveUrl": "https://www.sandbox.paypal.com/checkoutnow?token=5WD6…",
      "nonce": "f2051bc6e74c9560…"
    }
  }]
}`;

export default function Landing() {
  const checks = CHECK_ORDER.map((id) => ({ id, ...CHECK_META[id] }));
  return (
    <>
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-14 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-24">
          <div>
            <h1 className="t-display">
              Your next customer is an AI agent. Let it in.
            </h1>
            <p className="mt-6 max-w-[540px] text-[18px] leading-relaxed text-ink/75">
              Lintel finds what stops AI shopping agents at your store, fixes it with one script tag, and settles every
              agent purchase through PayPal, with the buyer’s approval.
            </p>
            <div className="mt-9"><ScanForm /></div>
          </div>
          <Doorway />
        </section>

        {/* Problem */}
        <section className="border-y border-line bg-subtle">
          <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-8 lg:py-24">
            <h2 className="t-h1 max-w-[760px] ">Most stores turn agents away without knowing it.</h2>
            <p className="mt-4 max-w-[600px] text-[17px] leading-relaxed text-muted">
              People now ask assistants like ChatGPT, Claude and Gemini to find and buy things. These four walls are common on small stores, and each one ends the sale.
            </p>
            <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              <Wall title="Bots are blocked" body="A default robots.txt tells AI agents to stay out, so your products never come up.">
                <pre className="font-mono text-[13px] leading-6 text-ink/80">User-agent: GPTBot{'\n'}<span className="bg-danger-wash text-danger">Disallow: /</span>{'\n'}{'\n'}User-agent: ClaudeBot{'\n'}<span className="bg-danger-wash text-danger">Disallow: /</span></pre>
              </Wall>
              <Wall title="A wall covers the page" body="Cookie banners and robot checks sit on top of everything an agent needs to read.">
                <div className="relative h-full">
                  <div className="space-y-2 opacity-40">{[80, 60, 70, 45].map((w) => <div key={w} className="h-2 rounded bg-muted/40" style={{ width: `${w}%` }} />)}</div>
                  <div className="absolute inset-x-0 bottom-0 rounded-lg border border-line bg-white p-3 shadow-[0_8px_24px_-12px_rgba(0,19,36,.35)]">
                    <p className="text-[12px] font-semibold">We value your privacy</p>
                    <div className="mt-2 flex gap-1.5"><span className="rounded bg-night px-2 py-0.5 text-[11px] text-white">Accept all</span><span className="rounded border border-line px-2 py-0.5 text-[11px]">Settings</span></div>
                  </div>
                </div>
              </Wall>
              <Wall title="Prices need JavaScript" body="The page an agent downloads has no prices in it. They only appear after scripts run.">
                <div>
                  <p className="text-[13px] font-semibold">Ethiopia Yirgacheffe, 12 oz</p>
                  <p className="mt-1 font-mono text-[13px] text-danger">{'<span class="price"></span>'}</p>
                  <div className="mt-4 h-8 w-24 rounded bg-muted/15" />
                </div>
              </Wall>
              <Wall title="Checkout needs an account" body="An agent can’t create an account and password for its owner at every store.">
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold">Create an account to check out</p>
                  <div className="h-7 rounded border border-line bg-white px-2 text-[12px] leading-7 text-muted">Email</div>
                  <div className="h-7 rounded border border-line bg-white px-2 text-[12px] leading-7 text-muted">Password</div>
                </div>
              </Wall>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-20 md:px-8 lg:py-28">
          <h2 className="t-h1 max-w-[720px] ">From closed to paid in one afternoon.</h2>
          <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
            <Step n={1} title="Scan">We read your store the way an agent does and score nine things that decide whether it can buy, out of 100.</Step>
            <Step n={2} title="Watch">A real AI agent tries to buy something while you watch every click, live, in a cloud browser.</Step>
            <Step n={3} title="Install">Add one script tag. AI rewrites your catalog so agents can understand it, and your store gets tools agents can call.</Step>
            <Step n={4} title="Get paid">Agents check out over HTTP. The buyer approves in PayPal, and the money lands in your PayPal account.</Step>
          </ol>
          <div className="mt-16 grid gap-6 rounded-xl border border-line bg-white p-6 sm:p-8 lg:grid-cols-2 lg:gap-12">
            <ScoreExample label="Before Lintel" score={0} pass={[]} note="The agent hit the account wall and gave up." />
            <ScoreExample label="After Lintel" score={100} pass={[...CHECK_ORDER]} note="The agent found the coffee and paid $22.00 through PayPal." />
          </div>
        </section>

        {/* Payments */}
        <section id="payments" className="scroll-mt-16 bg-night text-white">
          <div className="mx-auto grid max-w-[1200px] gap-14 px-5 py-20 md:px-8 lg:grid-cols-[1fr_1.05fr] lg:py-28 [&>*]:min-w-0">
            <div>
              <h2 className="t-h1 ">Agents pay over HTTP. You get paid in PayPal.</h2>
              <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-white/70">
                Lintel adds an x402 checkout to your store. x402 is the open standard for paying over HTTP. Lintel’s
                <span className="font-mono text-[0.9em] text-accent"> paypal-order</span> scheme settles it with PayPal, so there’s no wallet or crypto involved.
              </p>
              <ol className="mt-10 space-y-6">
                {[
                  ['The agent asks to buy', 'It posts a cart to your agent checkout.'],
                  ['Your store answers 402', 'Lintel prices the cart and creates a PayPal order for exactly that amount.'],
                  ['The buyer approves in PayPal', 'Nothing is charged until a person approves. The agent can’t spend on its own.'],
                  ['The agent returns with proof', 'Lintel checks the order, the amount and the cart, then captures the payment.'],
                ].map(([t, d], i) => (
                  <li key={t} className="grid grid-cols-[2.25rem_1fr] gap-3">
                    <span className="num grid h-7 w-7 place-items-center rounded-full border border-white/25 text-sm">{i + 1}</span>
                    <div><p className="font-semibold">{t}</p><p className="mt-0.5 text-[15px] text-white/60">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="min-w-0 self-center">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-night-raised">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-[13px] text-white/50">
                  <span className="font-mono">POST /m/ridgeline/agent/checkout</span>
                  <span className="rounded bg-warning/25 px-1.5 py-0.5 font-mono text-[12px] text-[#f1c46b]">402</span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.7] text-white/80">{RESPONSE_402}</pre>
              </div>
              <ul className="mt-6 grid gap-4 text-[15px] sm:grid-cols-3">
                {[['No wallets', 'Buyers pay with the PayPal account they have.'], ['Approval required', 'Every payment waits for a person.'], ['Never charged twice', 'Replayed proofs return the first receipt.']].map(([t, d]) => (
                  <li key={t}><p className="font-semibold">{t}</p><p className="mt-1 text-white/55">{d}</p></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Install */}
        <section className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 md:px-8 lg:grid-cols-2 lg:py-28 [&>*]:min-w-0">
          <div>
            <h2 className="t-h1 ">One script tag.</h2>
            <p className="mt-4 max-w-[500px] text-[17px] leading-relaxed text-muted">
              Paste it into your store’s &lt;head&gt;. It works on any store that lets you edit the page head, and you can remove it at any time.
            </p>
            <div className="mt-8 overflow-hidden rounded-xl bg-night">
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] text-white/85">{snippet(env.publicBaseUrl)}</pre>
            </div>
          </div>
          <div className="lg:pt-2">
            <p className="text-[15px] font-semibold">What your store gets</p>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {[
                ['Six agent tools', 'search_products, get_product, add_to_cart, view_cart, checkout_with_paypal, confirm_payment, through WebMCP in the browser.'],
                ['A catalog agents understand', '“ETH YIRG 12OZ - NAT” becomes “Ethiopia Yirgacheffe, Natural Process, 12 oz”. Prices and SKUs never change.'],
                ['Product data on every page', 'schema.org Product markup with name, price and stock.'],
                ['An agent checkout', 'An HTTP endpoint that answers 402 with a PayPal order, for agents that never open a browser.'],
              ].map(([t, d]) => (
                <div key={t} className="py-4"><dt className="font-semibold">{t}</dt><dd className="mt-1 text-[15px] leading-relaxed text-muted">{d}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        {/* Checks */}
        <section id="checks" className="scroll-mt-16 border-y border-line bg-subtle">
          <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-8 lg:py-24">
            <h2 className="t-h1 max-w-[760px] ">Nine stones hold the door open.</h2>
            <p className="mt-4 max-w-[620px] text-[17px] leading-relaxed text-muted">
              Each check is a stone in your lintel, as wide as it matters. The widest is the real test: an AI agent buying something from your store.
            </p>
            <Beam checks={checks.map((c) => ({ ...c, status: 'pass' as const }))} className="mt-10 h-10" animate={false} />
            <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {checks.map((c) => (
                <li key={c.id} className="grid grid-cols-[2.5rem_1fr] gap-2">
                  <span className="num pt-0.5 text-sm font-semibold text-muted">{c.weight}</span>
                  <div><p className="font-semibold leading-snug">{c.title}</p><p className="mt-1 text-sm leading-relaxed text-muted">{c.why}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto grid max-w-[1200px] scroll-mt-16 gap-10 px-5 py-20 md:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-28">
          <h2 className="t-h1 ">Questions</h2>
          <div className="divide-y divide-line border-y border-line">
            {[
              ['Can an agent spend money without me?', 'No. Every payment is a PayPal order that waits for a person to approve it in PayPal. Lintel only captures it after that approval, and only for the exact cart and amount that were approved.'],
              ['Where does the money go?', 'Straight to your PayPal business account, like any other PayPal sale. Lintel never holds funds.'],
              ['Do I have to change my checkout?', 'No. Your human checkout keeps working. Lintel adds a second door for agents next to it.'],
              ['Which agents can use it?', 'Browser agents use the WebMCP tools on your pages. API agents read your agent manifest and pay through the x402 checkout. Agents that click around also do better, because the walls are gone.'],
              ['What does it cost?', 'Lintel is free during the preview, and payments run in the PayPal sandbox.'],
            ].map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-semibold">
                  {q}
                  <span aria-hidden className="text-xl font-normal text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-[640px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-[1200px] px-5 pb-24 md:px-8">
          <div className="rounded-2xl bg-brand px-6 py-14 text-white sm:px-12">
            <h2 className="t-h1 max-w-[680px] ">See what an AI agent sees at your store.</h2>
            <div className="mt-8"><ScanForm tone="dark" /></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/app" variant="secondary">Open the dashboard</ButtonLink>
            <ButtonLink href="/docs" variant="ghost">Read the docs</ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Wall({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div>
      <div className="h-[150px] overflow-hidden rounded-xl border border-line bg-surface p-4">{children}</div>
      <h3 className="mt-5 text-[17px] font-semibold">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li>
      <span className="headline num text-[40px] leading-none text-ink/15">{n}</span>
      <h3 className="mt-3 text-[19px] font-semibold">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{children}</p>
    </li>
  );
}

function ScoreExample({ label, score, pass, note }: { label: string; score: number; pass: string[]; note: string }) {
  const stones = CHECK_ORDER.map((id) => ({ id, ...CHECK_META[id], status: pass.includes(id) ? ('pass' as const) : ('fail' as const) }));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <p className={`headline num text-[34px] leading-none ${score >= 75 ? 'text-brand' : 'text-danger'}`}>{score}<span className="text-base font-medium text-muted"> / 100</span></p>
      </div>
      <Beam checks={stones} className="mt-4 h-7" animate={false} />
      <p className="mt-3 text-[15px] text-muted">{note}</p>
    </div>
  );
}
