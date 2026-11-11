import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { ScanForm, DemoButton } from '@/components/ScanForm';
import { HeroShot } from '@/components/marketing';
import { HeroGateway } from '@/components/motion/HeroGateway';
import { HeroHeadline } from '@/components/motion/HeroHeadline';
import { ChatDemo } from '@/components/motion/ChatDemo';
import { Reveal } from '@/components/motion/Reveal';
import { PayPalMark } from '@/components/brand';
import { LandingMotion } from '@/components/motion/LandingMotion';
import { Beam, CHECK_ORDER } from '@/components/LintelScore';
import { CHECK_META } from '@/lib/scan/checks';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: { absolute: 'Lintel: let AI agents buy from your store' },
  description: 'Lintel finds what stops AI shopping agents at your store, fixes it with one script tag, and settles every agent purchase through PayPal.',
};

const RESPONSE_402 = `HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Mi…

{
  "x402Version": 2,
  "accepts": [{
    "scheme": "paypal-order",
    "network": "paypal:sandbox",
    "amount": "22.00",
    "asset": "USD",
    "extra": {
      "orderId": "5WD64056U3651162B",
      "approveUrl": "https://www.sandbox.paypal.com/…"
    }
  }]
}`;

export default function Landing() {
  const checks = CHECK_ORDER.map((id) => ({ id, ...CHECK_META[id] }));
  const before = checks.map((c) => ({ ...c, status: 'fail' as const }));
  const after = checks.map((c) => ({ ...c, status: 'pass' as const }));
  const snippet = `<script src="${env.publicBaseUrl}/lintel.js"\n  data-merchant="your-store" async></script>`;

  return (
    <>
      <SiteNav />
      <LandingMotion>
      <main>
        {/* Hero */}
        <section id="scan" className="relative scroll-mt-20 overflow-hidden bg-subtle">
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-14 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20 [&>*]:min-w-0">
            <div>
              <HeroHeadline className="t-display !text-[clamp(2.5rem,1.3rem+3.1vw,3.9rem)]" lines={['Your next customer', 'is an AI agent.', 'Let it in.']} />
              <p data-fade className="mt-6 max-w-[540px] text-lg leading-relaxed text-soft md:text-xl">
                AI assistants now shop for people. Lintel makes any store buyable by any AI agent, on WooCommerce, Wix,
                Squarespace, Webflow or your own code, and gets you paid through PayPal, with the buyer’s approval.
              </p>
              <div data-fade className="mt-9"><ScanForm /></div>
              <div data-fade className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <DemoButton variant="link" size="md" />
                <span className="flex items-center gap-2 text-[14px] text-muted"><PayPalMark className="h-3.5 w-3.5 text-ink" /> Settled through PayPal</span>
              </div>
            </div>
            <HeroGateway />
          </div>
        </section>

        {/* Standards */}
        <section className="border-y border-line bg-subtle">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-5 py-7 text-center md:flex-row md:justify-between md:px-8 md:text-left">
            <p className="text-sm text-muted">For the stores AI platforms don’t cover</p>
            <div className="marquee relative w-full overflow-hidden md:max-w-[760px]" aria-label="WooCommerce, Wix, Squarespace, Webflow, BigCommerce and custom stores">
              <ul className="marquee-track flex w-max items-center gap-x-12 text-[17px] font-semibold tracking-tight text-ink/55" aria-hidden>
                {[0, 1].map((k) => ['WooCommerce', 'Wix', 'Squarespace', 'Webflow', 'BigCommerce', 'Custom stores'].map((n) => <li key={`${k}-${n}`} className="whitespace-nowrap">{n}</li>))}
              </ul>
            </div>
          </div>
        </section>

        {/* Why now + the lost sale */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-24 md:px-8 lg:grid-cols-[1fr_1.1fr] lg:py-32 [&>*]:min-w-0">
          <div>
            <h2 data-reveal className="t-h1 max-w-[520px]">Shoppers are handing checkout to AI.</h2>
            <p data-reveal className="mt-5 max-w-[500px] text-lg leading-relaxed text-soft">
              Assistants like ChatGPT, Perplexity and Google now find products, compare stores and pay on a shopper’s behalf.
              They buy from the stores they can read and pay. Everyone else gets skipped.
            </p>
            <div data-reveal className="mt-10 border-l-2 border-brand pl-5">
              <p className="text-lg font-semibold">And you never find out.</p>
              <p className="mt-1.5 max-w-[460px] leading-relaxed text-soft">
                There’s no abandoned cart and no error in your analytics. The agent simply buys from someone else.
              </p>
            </div>
          </div>
          <ChatDemo />
        </section>

        {/* Problem */}
        <section className="border-y border-line bg-subtle">
          <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 lg:py-28">
            <div className="max-w-[640px]">
              <h2 data-reveal className="t-h1">Four walls that send agents away.</h2>
              <p data-reveal className="mt-4 text-lg leading-relaxed text-soft">Each one is normal for a person. For an agent, each one ends the visit.</p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Wall title="Bots are blocked" body="A default robots.txt tells AI agents to stay out, so your products never come up.">
                <pre className="font-mono text-[12.5px] leading-6 text-soft">User-agent: GPTBot{'\n'}<span className="rounded bg-danger-wash px-1 text-danger">Disallow: /</span>{'\n'}User-agent: ClaudeBot{'\n'}<span className="rounded bg-danger-wash px-1 text-danger">Disallow: /</span></pre>
              </Wall>
              <Wall title="A wall covers the page" body="Cookie banners and robot checks sit on top of everything an agent needs to read.">
                <div className="relative h-full">
                  <div className="space-y-2">{[80, 60, 70, 45].map((w) => <div key={w} className="h-2 rounded bg-line" style={{ width: `${w}%` }} />)}</div>
                  <div className="absolute inset-x-0 bottom-0 rounded-lg bg-surface p-3 shadow-[var(--shadow-window)]">
                    <p className="text-[12px] font-semibold">We value your privacy</p>
                    <div className="mt-2 flex gap-1.5"><span className="rounded-md bg-ink px-2 py-0.5 text-[11px] text-white">Accept all</span><span className="rounded-md border border-line px-2 py-0.5 text-[11px]">Settings</span></div>
                  </div>
                </div>
              </Wall>
              <Wall title="Prices need JavaScript" body="The page an agent downloads has no prices in it. They only appear after scripts run.">
                <p className="text-[13px] font-semibold">Ethiopia Yirgacheffe, 12 oz</p>
                <p className="mt-1.5 font-mono text-[12.5px] text-danger">{'<span class="price"></span>'}</p>
                <div className="mt-4 h-8 w-24 animate-pulse rounded-md bg-line" />
              </Wall>
              <Wall title="Checkout needs an account" body="An agent can’t create an account and password for its owner at every store.">
                <p className="text-[13px] font-semibold">Create an account to check out</p>
                <div className="mt-2 h-7 rounded-md border border-line bg-surface px-2 text-[12px] leading-7 text-muted">Email</div>
                <div className="mt-1.5 h-7 rounded-md border border-line bg-surface px-2 text-[12px] leading-7 text-muted">Password</div>
              </Wall>
            </div>
          </div>
        </section>

        {/* Solution bento */}
        <section id="product" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-24 md:px-8 lg:py-32">
          <div className="max-w-[680px]">
            <h2 data-reveal className="t-h1">Lintel opens the door, without a rebuild.</h2>
            <p data-reveal className="mt-4 text-lg leading-relaxed text-soft">Keep your store, your theme and your checkout. Lintel adds what agents need on top.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-5 [&>*]:min-w-0">
            <Card className="md:col-span-3" step="Scan" title="See your store the way an agent does" body="Nine checks that decide whether an agent can buy, scored out of 100 and explained in plain English.">
              <div className="space-y-5 rounded-xl bg-subtle p-5">
                <ScoreRow label="Before Lintel" score={0} checks={before} />
                <ScoreRow label="After Lintel" score={100} checks={after} />
              </div>
            </Card>
            <Card className="md:col-span-2" step="Watch" title="Send a real agent to buy" body="Watch every click in a live cloud browser, so you know it works before your customers’ agents arrive.">
              <ul className="space-y-2.5 rounded-xl bg-subtle p-5 text-[13.5px]">
                {['Opened the store', 'Found 6 store tools', 'Added RC-ETH12 to cart', 'Asked you to approve $22.00'].map((t, i) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className={`grid h-4.5 w-4.5 h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-bold text-white ${i === 3 ? 'bg-warning' : 'bg-brand'}`}>{i === 3 ? '$' : '✓'}</span>{t}
                  </li>
                ))}
                <li className="flex items-center gap-2.5 text-muted"><span className="pulse-dot h-[18px] w-[18px] rounded-full border-2 border-brand/40" />Waiting for your approval</li>
              </ul>
            </Card>
            <Card className="md:col-span-2" step="Install" title="One script tag" body="AI rewrites your catalog so agents understand it. Prices and SKUs never change.">
              <pre className="overflow-x-auto rounded-xl bg-night p-4 font-mono text-[12px] leading-[1.7] text-white/85">{snippet}</pre>
              <p className="mt-3 rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted">
                <span className="font-mono text-danger line-through decoration-danger/50">ETH YIRG 12OZ - NAT</span><br />
                <span className="font-medium text-ink">Ethiopia Yirgacheffe, Natural Process, 12 oz</span>
              </p>
            </Card>
            <Card className="md:col-span-3" step="Get paid" title="Agents pay. People approve. PayPal settles." body="Every purchase is a PayPal order the buyer approves. The money lands in your PayPal account, with the protections you already have.">
              <div className="grid gap-3 rounded-xl bg-subtle p-5 sm:grid-cols-2">
                <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
                  <p className="text-[12.5px] font-medium text-warning">Waiting for approval</p>
                  <p className="t-stat mt-1 text-[26px]">$22.00</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_-6px_rgb(45_45_241/.55)]"><PayPalMark className="h-3.5 w-3.5" /> Approve in PayPal</span>
                </div>
                <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-card)]">
                  <p className="text-[12.5px] font-medium text-success-ink">Paid through PayPal</p>
                  <p className="t-stat mt-1 text-[26px]">$22.00</p>
                  <p className="num mt-3 text-[12.5px] text-muted">Capture 5MX0…3401116</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Product shot */}
        <section className="mx-auto max-w-[1200px] px-5 pb-24 md:px-8 lg:pb-32">
          <div className="mx-auto max-w-[720px] text-center">
            <h2 data-reveal className="t-h1">Every agent visit, on the record.</h2>
            <p data-reveal className="mt-4 text-lg leading-relaxed text-soft">See each step an agent takes in your store, the moment it asks to pay, and the PayPal capture when it does.</p>
          </div>
          <Reveal className="relative mx-auto mt-14 max-w-[1080px]">
            <div className="relative"><HeroShot /></div>
          </Reveal>
        </section>

        {/* Payments */}
        <section id="payments" className="scroll-mt-16 border-y border-line bg-subtle">
          <div className="mx-auto grid max-w-[1200px] gap-14 px-5 py-24 md:px-8 lg:grid-cols-[1fr_1.05fr] lg:py-32 [&>*]:min-w-0">
            <div>
              <h2 data-reveal className="t-h1">An agent checkout your customers can trust.</h2>
              <p data-reveal className="mt-5 max-w-[520px] text-lg leading-relaxed text-soft">
                Lintel adds an <span className="font-semibold text-ink">x402</span> checkout to your store, the open standard for paying over HTTP.
                Its <span className="rounded-md bg-brand-wash px-1.5 py-0.5 font-mono text-[0.85em] text-brand-ink">paypal-order</span> scheme settles in PayPal, so there are no wallets and no crypto.
              </p>
              <ol data-steps className="relative mt-10 space-y-6">
                <span aria-hidden className="absolute left-[15px] top-4 bottom-4 w-px bg-line-strong" />
                <span aria-hidden data-steps-line className="absolute left-[15px] top-4 bottom-4 w-px origin-top bg-brand" />
                {[
                  ['The agent asks to buy', 'It posts a cart to your agent checkout.'],
                  ['Your store answers 402', 'Lintel prices the cart and creates a PayPal order for exactly that amount.'],
                  ['The buyer approves in PayPal', 'Nothing is charged until a person approves. The agent can’t spend on its own.'],
                  ['Lintel verifies, then captures', 'Same order, same amount, same cart, or no capture. Replays never charge twice.'],
                ].map(([t, d], i) => (
                  <li data-reveal key={t} className="relative grid grid-cols-[2.25rem_1fr] gap-3">
                    <span className="num grid h-8 w-8 place-items-center rounded-full bg-surface text-sm font-semibold text-brand shadow-[var(--shadow-card)]">{i + 1}</span>
                    <div><p className="font-semibold">{t}</p><p className="mt-0.5 text-[15px] text-muted">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="self-center">
              <div className="overflow-hidden rounded-2xl bg-night shadow-[var(--shadow-window)]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[13px] text-white/55">
                  <span className="font-mono">POST /m/ridgeline/agent/checkout</span>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[12px] text-brand-bright">402</span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.75] text-white/80">{RESPONSE_402}</pre>
              </div>
              <Link href="/docs#scheme" className="mt-5 inline-flex text-sm font-medium text-brand hover:text-brand-hover">Read the scheme in the docs</Link>
            </div>
          </div>
        </section>

        {/* Nine checks */}
        <section id="checks" className="mx-auto max-w-[1200px] scroll-mt-16 px-5 py-24 md:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 data-reveal className="t-h1">What we check.</h2>
              <p data-reveal className="mt-4 leading-relaxed text-soft">Nine checks, weighted by how much they decide a sale. The heaviest is the real test: an AI agent buying from your store.</p>
              <div data-beam-fill className="mt-8"><Beam checks={after} className="h-3" animate={false} /></div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {checks.map((c) => (
                <li data-reveal key={c.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug">{c.title}</p>
                    <span className="num shrink-0 rounded-md bg-brand-wash px-1.5 py-0.5 text-[12px] font-semibold text-brand-ink">{c.weight} pts</span>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{c.why}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Agent builders */}
        <section id="agents" className="mx-auto grid max-w-[1200px] scroll-mt-16 items-center gap-12 px-5 py-24 md:px-8 lg:grid-cols-2 lg:py-28 [&>*]:min-w-0">
          <div>
            <h2 data-reveal className="t-h1">Open to every agent, not just a few.</h2>
            <p data-reveal className="mt-4 max-w-[520px] text-lg leading-relaxed text-soft">
              Big platforms open stores to the assistants they partner with. A Lintel store works with any agent that speaks x402. Agent builders add buying in three lines with <span className="font-mono text-[0.9em] text-ink">@lintel-agent/sdk</span>.
            </p>
            <ul className="mt-8 space-y-3 text-[15px]">
              {['Finds the store from its page, no directory needed', 'Reads the catalog with real SKUs, prices and stock', 'Pays only after the person approves in PayPal'].map((t) => (
                <li key={t} className="flex gap-3"><span aria-hidden className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] text-white">✓</span>{t}</li>
              ))}
            </ul>
            <Link href="/docs#sdk" className="mt-8 inline-flex text-sm font-medium text-brand hover:text-brand-hover">Read the SDK docs</Link>
          </div>
          <div data-reveal className="overflow-hidden rounded-2xl bg-night shadow-[var(--shadow-window)]">
            <div className="border-b border-white/10 px-4 py-3 font-mono text-[13px] text-white/55">agent.ts</div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.75] text-white/85">{`import { discover, buy } from '@lintel-agent/sdk';

const store = await discover('https://fernwoodtea.com');

const receipt = await buy(store, [{ sku: 'FW-SEN-50', qty: 1 }], {
  onApprovalRequired: ({ approveUrl, amount }) =>
    ask(\`Approve $\${amount} in PayPal: \${approveUrl}\`),
});`}</pre>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-line bg-subtle">
          <div className="mx-auto grid max-w-[1200px] scroll-mt-16 gap-10 px-5 py-24 md:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-28">
            <h2 data-reveal className="t-h1">Questions merchants ask.</h2>
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-6">
              {[
                ['Can an agent spend money without me?', 'No. Every payment is a PayPal order that waits for a person to approve it in PayPal. Lintel only captures it after that approval, and only for the exact cart and amount that were approved.'],
                ['Where does the money go?', 'Straight to your PayPal business account, like any other PayPal sale. Lintel never holds funds.'],
                ['Do I have to change my checkout?', 'No. Your human checkout keeps working. Lintel adds a second door for agents next to it.'],
                ['Which agents can use it?', 'Browser agents use the WebMCP tools on your pages. API agents read your agent manifest and pay through the x402 checkout. Agents that click around do better too, because the walls are gone.'],
                ['I’m on Shopify. Do I need Lintel?', 'Turn on Shopify’s Agentic Storefronts first: it lists your products in ChatGPT, Copilot and other assistants Shopify partners with. Lintel adds what it doesn’t: a readiness score, a real agent test, and a PayPal checkout that any agent can use, not only partnered assistants.'],
                ['What does it cost?', 'Lintel is free during the preview. Payments run in the PayPal sandbox until launch.'],
              ].map(([q, a]) => (
                <details data-reveal key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-semibold">
                    {q}
                    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subtle text-lg font-normal text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-[620px] leading-relaxed text-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-[1200px] px-5 py-24 md:px-8">
          <div data-reveal className="relative overflow-hidden rounded-3xl bg-brand px-6 py-16 text-center text-white sm:px-12 md:py-20">
            <h2 data-reveal className="t-h1 mx-auto max-w-[720px]">See what an AI agent sees at your store.</h2>
            <p data-reveal className="mx-auto mt-4 max-w-[520px] text-lg text-white/80">Get your score in seconds, then watch a real agent try to buy.</p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <ScanForm tone="dark" align="center" />
              <DemoButton variant="onDark" size="md" />
            </div>
          </div>
        </section>
      </main>
      </LandingMotion>
      <SiteFooter />
    </>
  );
}

function Wall({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div data-reveal className="flex flex-col rounded-2xl border border-line bg-surface p-2 transition-colors hover:border-ink/20">
      <div className="h-[150px] overflow-hidden rounded-xl bg-subtle p-4">{children}</div>
      <div className="px-3 pb-3 pt-4">
        <h3 className="text-[17px] font-semibold">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

function Card({ step, title, body, children, className = '' }: { step: string; title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <div data-reveal className={`flex flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-ink/20 ${className}`}>
      <p className="text-[13px] font-semibold text-brand">{step}</p>
      <h3 className="t-h3 mt-1.5">{title}</h3>
      <p className="mt-2 max-w-[460px] text-[15px] leading-relaxed text-muted">{body}</p>
      <div className="mt-6 flex-1">{children}</div>
    </div>
  );
}

function ScoreRow({ label, score, checks }: { label: string; score: number; checks: { id: string; weight: number; status: 'pass' | 'fail'; title: string }[] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="t-stat text-[22px]">{score}<span className="text-[13px] font-medium text-muted"> /100</span></p>
      </div>
      <Beam checks={checks as any} className="mt-2 h-2.5" animate={false} />
    </div>
  );
}
