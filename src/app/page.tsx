import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { ScanForm, DemoButton } from '@/components/ScanForm';
import { HeroShot, LostSale } from '@/components/marketing';
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
      <main>
        {/* Hero */}
        <section id="scan" className="relative scroll-mt-20 overflow-hidden">
          <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-16 text-center md:px-8 md:pt-24">
            <Link href="#payments" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pl-1 pr-3 text-[13px] text-soft shadow-[var(--shadow-card)] backdrop-blur hover:text-ink">
              <span className="rounded-full bg-brand-wash px-2 py-0.5 font-semibold text-brand-ink">New</span>
              <span className="sm:hidden">Agent checkout, paid through PayPal</span>
              <span className="hidden sm:inline">Agent checkout over x402, paid through PayPal</span>
            </Link>
            <h1 className="t-display mx-auto mt-7 max-w-[1140px]">Your next customer is an AI&nbsp;agent. <span className="whitespace-nowrap md:block">Let it in.</span></h1>
            <p className="mx-auto mt-6 max-w-[620px] text-lg leading-relaxed text-soft md:text-xl">
              Lintel finds what stops AI shopping agents at your store, fixes it with one script tag, and settles every agent
              purchase through PayPal, with the buyer’s approval.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <ScanForm align="center" />
              <DemoButton variant="link" size="md" />
            </div>
            <div className="relative mx-auto mt-16 max-w-[1080px] text-left">
              <div className="brand-gradient pointer-events-none absolute -inset-x-10 top-10 bottom-0 rounded-[40px] opacity-[.18] blur-3xl" aria-hidden />
              <div className="relative"><HeroShot /></div>
            </div>
          </div>
        </section>

        {/* Standards */}
        <section className="border-y border-line bg-subtle">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-5 py-7 text-center md:flex-row md:justify-between md:px-8 md:text-left">
            <p className="text-sm text-muted">Built on open standards, settled by PayPal</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-9 gap-y-2 text-[17px] font-semibold tracking-tight text-ink/55">
              <li>x402</li><li>WebMCP</li><li>schema.org</li><li>PayPal Orders v2</li>
            </ul>
          </div>
        </section>

        {/* Why now + the lost sale */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-24 md:px-8 lg:grid-cols-2 lg:py-32 [&>*]:min-w-0">
          <div>
            <h2 className="t-h1 max-w-[520px]">Shoppers are handing checkout to AI.</h2>
            <p className="mt-5 max-w-[500px] text-lg leading-relaxed text-soft">
              Assistants like ChatGPT, Perplexity and Google now find products, compare stores and pay on a shopper’s behalf.
              They buy from the stores they can read and pay. Everyone else gets skipped.
            </p>
            <div className="mt-10 border-l-2 border-brand pl-5">
              <p className="text-lg font-semibold">And you never find out.</p>
              <p className="mt-1.5 max-w-[460px] leading-relaxed text-soft">
                There’s no abandoned cart and no error in your analytics. The agent simply buys from someone else.
              </p>
            </div>
          </div>
          <LostSale />
        </section>

        {/* Problem */}
        <section className="border-y border-line bg-subtle">
          <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 lg:py-28">
            <div className="max-w-[640px]">
              <h2 className="t-h1">Four walls that send agents away.</h2>
              <p className="mt-4 text-lg leading-relaxed text-soft">Each one is normal for a person. For an agent, each one ends the visit.</p>
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
            <h2 className="t-h1">Lintel opens the door, without a rebuild.</h2>
            <p className="mt-4 text-lg leading-relaxed text-soft">Keep your store, your theme and your checkout. Lintel adds what agents need on top.</p>
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
                  <span className="mt-3 inline-flex rounded-lg bg-paypal px-3 py-1.5 text-[12.5px] font-bold text-paypal-ink">Approve in PayPal</span>
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

        {/* Payments */}
        <section id="payments" className="night-glow scroll-mt-16 text-white">
          <div className="mx-auto grid max-w-[1200px] gap-14 px-5 py-24 md:px-8 lg:grid-cols-[1fr_1.05fr] lg:py-32 [&>*]:min-w-0">
            <div>
              <h2 className="t-h1">An agent checkout your customers can trust.</h2>
              <p className="mt-5 max-w-[520px] text-lg leading-relaxed text-white/70">
                Lintel adds an <span className="font-semibold text-white">x402</span> checkout to your store, the open standard for paying over HTTP.
                Its <span className="font-mono text-[0.9em] text-accent">paypal-order</span> scheme settles in PayPal, so there are no wallets and no crypto.
              </p>
              <ol className="mt-10 space-y-6">
                {[
                  ['The agent asks to buy', 'It posts a cart to your agent checkout.'],
                  ['Your store answers 402', 'Lintel prices the cart and creates a PayPal order for exactly that amount.'],
                  ['The buyer approves in PayPal', 'Nothing is charged until a person approves. The agent can’t spend on its own.'],
                  ['Lintel verifies, then captures', 'Same order, same amount, same cart, or no capture. Replays never charge twice.'],
                ].map(([t, d], i) => (
                  <li key={t} className="grid grid-cols-[2.25rem_1fr] gap-3">
                    <span className="num grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm font-semibold ring-1 ring-white/15">{i + 1}</span>
                    <div><p className="font-semibold">{t}</p><p className="mt-0.5 text-[15px] text-white/60">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="self-center">
              <div className="overflow-hidden rounded-2xl bg-night-raised/80 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[13px] text-white/55">
                  <span className="font-mono">POST /m/ridgeline/agent/checkout</span>
                  <span className="rounded-md bg-paypal/15 px-2 py-0.5 font-mono text-[12px] text-paypal">402</span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.75] text-white/80">{RESPONSE_402}</pre>
              </div>
              <Link href="/docs#scheme" className="mt-5 inline-flex text-sm font-medium text-brand-bright hover:text-white">Read the scheme in the docs</Link>
            </div>
          </div>
        </section>

        {/* Nine checks */}
        <section id="checks" className="mx-auto max-w-[1200px] scroll-mt-16 px-5 py-24 md:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="t-h1">What we check.</h2>
              <p className="mt-4 leading-relaxed text-soft">Nine checks, weighted by how much they decide a sale. The heaviest is the real test: an AI agent buying from your store.</p>
              <Beam checks={after} className="mt-8 h-3" animate={false} />
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {checks.map((c) => (
                <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
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

        {/* FAQ */}
        <section id="faq" className="border-t border-line bg-subtle">
          <div className="mx-auto grid max-w-[1200px] scroll-mt-16 gap-10 px-5 py-24 md:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-28">
            <h2 className="t-h1">Questions merchants ask.</h2>
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-6">
              {[
                ['Can an agent spend money without me?', 'No. Every payment is a PayPal order that waits for a person to approve it in PayPal. Lintel only captures it after that approval, and only for the exact cart and amount that were approved.'],
                ['Where does the money go?', 'Straight to your PayPal business account, like any other PayPal sale. Lintel never holds funds.'],
                ['Do I have to change my checkout?', 'No. Your human checkout keeps working. Lintel adds a second door for agents next to it.'],
                ['Which agents can use it?', 'Browser agents use the WebMCP tools on your pages. API agents read your agent manifest and pay through the x402 checkout. Agents that click around do better too, because the walls are gone.'],
                ['What does it cost?', 'Lintel is free during the preview. Payments run in the PayPal sandbox until launch.'],
              ].map(([q, a]) => (
                <details key={q} className="group py-5">
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
          <div className="night-glow relative overflow-hidden rounded-3xl px-6 py-16 text-center text-white sm:px-12 md:py-20">
            <h2 className="t-h1 mx-auto max-w-[720px]">See what an AI agent sees at your store.</h2>
            <p className="mx-auto mt-4 max-w-[520px] text-lg text-white/70">Get your score in seconds, then watch a real agent try to buy.</p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <ScanForm tone="dark" align="center" />
              <DemoButton variant="onDark" size="md" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Wall({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-2">
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
    <div className={`flex flex-col rounded-2xl border border-line bg-surface p-6 ${className}`}>
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
