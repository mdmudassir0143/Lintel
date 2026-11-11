import type { ReactNode } from 'react';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Developer docs', description: 'The Lintel agent manifest, the x402 paypal-order scheme, and the lintel.js WebMCP tools.' };

const SECTIONS = [
  ['overview', 'Overview'],
  ['install', 'Install'],
  ['manifest', 'Agent manifest'],
  ['catalog', 'Catalog'],
  ['scheme', 'Checkout: x402 over PayPal'],
  ['errors', 'Errors'],
  ['tools', 'lintel.js tools'],
] as const;

export default function Docs() {
  const base = env.publicBaseUrl;
  const m = `${base}/m/{merchant}/agent`;
  return (
    <>
      <SiteNav />
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-14 md:px-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-[15px]">
            <p className="mb-3 font-semibold">Developer docs</p>
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded px-2 py-1 text-weather hover:bg-white hover:text-basalt">{label}</a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-[760px]">
          <h1 className="inscribe text-[40px] leading-tight">Developer docs</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-weather">
            How agents find a Lintel store, read its catalog, and pay for a cart. Everything here is plain HTTP and JSON.
          </p>

          <Section id="overview" title="Overview">
            <p>A store running Lintel offers agents two ways in:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Browser agents</b> call the WebMCP tools that <C>lintel.js</C> registers on every page.</li>
              <li><b>API agents</b> follow the <C>agent-manifest</C> link to a JSON catalog and an x402 checkout.</li>
            </ul>
            <p>Both end in the same place: a PayPal order the buyer approves, captured only after Lintel verifies it.</p>
          </Section>

          <Section id="install" title="Install">
            <p>Add these two tags to the store’s <C>&lt;head&gt;</C>:</p>
            <Pre>{`<script src="${base}/lintel.js" data-merchant="{merchant}" data-base="${base}" async></script>
<link rel="agent-manifest" href="${m}/manifest.json">`}</Pre>
          </Section>

          <Section id="manifest" title="Agent manifest">
            <Endpoint method="GET" path={`${m}/manifest.json`} />
            <Pre>{`{
  "name": "Ridgeline Coffee Roasters",
  "catalog": "${base}/m/ridgeline/agent/catalog",
  "checkout": {
    "url": "${base}/m/ridgeline/agent/checkout",
    "method": "POST",
    "protocol": "x402",
    "x402Version": 2,
    "schemes": ["paypal-order"]
  },
  "webmcp": true
}`}</Pre>
          </Section>

          <Section id="catalog" title="Catalog">
            <Endpoint method="GET" path={`${m}/catalog`} />
            <p>Returns every product with its SKU, a clear title, price in USD, attributes and stock.</p>
            <Pre>{`{ "products": [{
  "sku": "RC-ETH12",
  "title": "Ethiopia Yirgacheffe — Natural Process, 12 oz",
  "price": "22.00", "currency": "USD",
  "attributes": { "origin": "Ethiopia", "size": "12 oz", "process": "natural" },
  "inStock": true
}] }`}</Pre>
          </Section>

          <Section id="scheme" title="Checkout: x402 over PayPal">
            <p>
              Checkout follows <a className="underline underline-offset-4" href="https://www.x402.org" target="_blank" rel="noreferrer">x402</a> version 2.
              Lintel defines the payment scheme <C>paypal-order</C> on network <C>paypal:sandbox</C>: the payment is a PayPal Orders v2 order, approved by a person in PayPal and captured by Lintel.
            </p>
            <h3 className="pt-2 font-semibold">1. Post the cart</h3>
            <Endpoint method="POST" path={`${m}/checkout`} />
            <Pre>{`{ "items": [{ "sku": "RC-ETH12", "qty": 1 }] }`}</Pre>
            <h3 className="pt-2 font-semibold">2. Receive 402 Payment Required</h3>
            <p>The body (also base64-encoded in the <C>PAYMENT-REQUIRED</C> header) names one PayPal order for exactly this cart:</p>
            <Pre>{`{
  "x402Version": 2,
  "accepts": [{
    "scheme": "paypal-order",
    "network": "paypal:sandbox",
    "amount": "22.00",
    "asset": "USD",
    "payTo": "ridgeline",
    "maxTimeoutSeconds": 900,
    "resource": "${base}/m/ridgeline/agent/checkout",
    "extra": { "orderId": "5WD64056U3651162B", "approveUrl": "https://www.sandbox.paypal.com/checkoutnow?token=…", "nonce": "f2051bc6…" }
  }]
}`}</Pre>
            <h3 className="pt-2 font-semibold">3. Get the buyer’s approval</h3>
            <p>Show the buyer <C>approveUrl</C>. They log in to PayPal and approve. Agents never see card or account details.</p>
            <h3 className="pt-2 font-semibold">4. Retry with proof</h3>
            <p>Send the same cart again with a <C>PAYMENT-SIGNATURE</C> header: base64 of</p>
            <Pre>{`{ "x402Version": 2, "scheme": "paypal-order", "network": "paypal:sandbox",
  "payload": { "orderId": "5WD64056U3651162B", "nonce": "f2051bc6…" } }`}</Pre>
            <p>
              Lintel checks that the nonce belongs to this store, the cart is unchanged, the order matches, PayPal reports it approved, and the amount and nonce match the order.
              Only then does it capture. The response is <C>200</C> with a <C>PAYMENT-RESPONSE</C> receipt header:
            </p>
            <Pre>{`{ "status": "paid", "paypalOrderId": "5WD64056U3651162B", "captureId": "5MX09897CT3401116", "amount": "22.00",
  "lines": [{ "sku": "RC-ETH12", "qty": 1, "unit": "22.00", "total": "22.00" }] }`}</Pre>
            <p>Sending the same proof again returns the same receipt and never captures twice.</p>
          </Section>

          <Section id="errors" title="Errors">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[15px]">
                <thead className="text-[13px] text-weather"><tr className="border-b border-joint"><th className="py-2 font-medium">Status</th><th className="font-medium">error</th><th className="font-medium">Meaning</th></tr></thead>
                <tbody className="divide-y divide-joint">
                  {[
                    ['402', 'payment_not_approved', 'The buyer hasn’t approved yet. The body repeats the original requirement, so keep the same order.'],
                    ['400', 'cart_mismatch', 'The cart changed after the order was created. Start checkout again.'],
                    ['400', 'order_mismatch', 'The proof names a different order than the nonce was issued for.'],
                    ['400', 'unknown_nonce', 'The nonce wasn’t issued by this store.'],
                    ['400', 'amount_mismatch', 'PayPal’s order doesn’t match the price Lintel quoted.'],
                    ['400', 'invalid_payload', 'The PAYMENT-SIGNATURE header couldn’t be read.'],
                    ['402', 'capture_failed', 'PayPal declined the capture.'],
                    ['404', 'not_installed', 'This store hasn’t turned on Lintel.'],
                  ].map(([s, e, d]) => (
                    <tr key={e} className="align-top"><td className="num py-2.5 pr-4">{s}</td><td className="py-2.5 pr-4"><C>{e}</C></td><td className="py-2.5 text-weather">{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="tools" title="lintel.js tools">
            <p>
              <C>lintel.js</C> registers these tools with <C>document.modelContext</C> (WebMCP), and falls back to its own copy of that interface in browsers without it.
              Tools marked consequential ask the agent to involve the person first.
            </p>
            <dl className="divide-y divide-joint border-y border-joint">
              {[
                ['search_products', '{ query }', 'Products whose name, description or attributes match every word.'],
                ['get_product', '{ sku }', 'One product in full.'],
                ['add_to_cart', '{ sku, qty }', 'Adds to the cart kept for this browser tab.'],
                ['view_cart', '{}', 'Cart lines and total.'],
                ['checkout_with_paypal', '{}', 'Consequential. Starts x402 checkout and returns the PayPal approveUrl, orderId and nonce.'],
                ['confirm_payment', '{ orderId?, nonce? }', 'Consequential. After approval, pays with the proof. Defaults to the last checkout.'],
              ].map(([n, a, d]) => (
                <div key={n} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr]">
                  <dt><C>{n}</C> <span className="font-mono text-[12px] text-weather">{a}</span></dt>
                  <dd className="text-weather">{d}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </article>
      </div>
      <SiteFooter />
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-joint pt-10 mt-12">
      <h2 className="inscribe text-[24px]">{title}</h2>
      <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-basalt/85">{children}</div>
    </section>
  );
}

function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-plaster-deep px-1.5 py-0.5 font-mono text-[0.85em] text-basalt">{children}</code>;
}

function Pre({ children }: { children: ReactNode }) {
  return <pre className="overflow-x-auto rounded-[10px] bg-basalt p-4 font-mono text-[12.5px] leading-[1.7] text-white/85">{children}</pre>;
}

function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 font-mono text-[13px]">
      <span className={`rounded px-1.5 py-0.5 font-semibold ${method === 'GET' ? 'bg-patina-wash text-patina-deep' : 'bg-ochre-wash text-ochre'}`}>{method}</span>
      <span className="break-all">{path}</span>
    </p>
  );
}
