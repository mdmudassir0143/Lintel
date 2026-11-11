import type { SiteSnapshot } from './fetchSite';

export type CheckId =
  | 'live_agent' | 'robots_allows_ai' | 'product_jsonld' | 'server_rendered_prices' | 'no_blocking_interstitial'
  | 'guest_checkout' | 'paypal_checkout' | 'webmcp_tools' | 'agent_checkout' | 'site_unreachable';

export interface CheckResult {
  id: CheckId;
  status: 'pass' | 'partial' | 'fail';
  weight: number;
  earned?: number;
  title: string;
  why: string;
  evidence: string;
}

export type LiveOutcome = 'completed' | 'reached_payment' | 'added_to_cart' | 'found_product' | 'failed' | 'not_run';

const AI_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];

export const CHECK_META: Record<Exclude<CheckId, 'site_unreachable'>, { weight: number; title: string; why: string }> = {
  live_agent: { weight: 30, title: 'An AI agent can complete a purchase', why: 'This is the real test: we send an AI shopping agent to find a product and pay.' },
  product_jsonld: { weight: 15, title: 'Products are machine-readable', why: 'Agents read structured product data (name, price, stock) instead of guessing from page layout.' },
  server_rendered_prices: { weight: 10, title: 'Prices are visible without JavaScript', why: 'Many agents read the raw page. If prices only appear after scripts run, the agent sees no prices.' },
  no_blocking_interstitial: { weight: 10, title: 'No pop-ups block the page', why: 'Cookie walls, captchas and "I\'m not a robot" checks stop agents before they see anything.' },
  paypal_checkout: { weight: 10, title: 'Checkout accepts PayPal', why: 'Agents need a payment method that lets the buyer approve safely without sharing card numbers.' },
  webmcp_tools: { weight: 10, title: 'Store offers agent tools (WebMCP)', why: 'WebMCP lets browser agents call "search", "add to cart" and "checkout" directly instead of clicking around.' },
  robots_allows_ai: { weight: 5, title: 'AI agents are allowed in', why: 'Your robots.txt tells AI crawlers and agents whether they may visit. Blocking them hides your products.' },
  guest_checkout: { weight: 5, title: 'Guest checkout (no forced account)', why: 'Agents cannot create accounts or remember passwords for each store.' },
  agent_checkout: { weight: 5, title: 'Agents can pay over HTTP (x402)', why: 'Headless agents need an API checkout that says what to pay and how, then confirms payment.' },
};

function result(id: Exclude<CheckId, 'site_unreachable'>, status: CheckResult['status'], evidence: string): CheckResult {
  return { id, status, ...CHECK_META[id], evidence };
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

function robotsBlocksAi(robots: string): string[] {
  const blocked: string[] = [];
  const groups = robots.split(/\n(?=\s*user-agent:)/i);
  for (const g of groups) {
    const agents = [...g.matchAll(/user-agent:\s*(\S+)/gi)].map((m) => m[1]);
    const disallowAll = /^\s*disallow:\s*\/\s*$/im.test(g);
    if (!disallowAll) continue;
    for (const a of agents) {
      if (a === '*' || AI_BOTS.some((b) => b.toLowerCase() === a.toLowerCase())) blocked.push(a);
    }
  }
  return blocked;
}

function jsonLdProducts(html: string): any[] {
  const out: any[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : data['@graph'] ?? [data];
      for (const it of items) if (String(it?.['@type']).includes('Product')) out.push(it);
    } catch {}
  }
  return out;
}

export function runStaticChecks(s: SiteSnapshot): CheckResult[] {
  if (!s.ok || !s.html) {
    const why = s.error ?? 'Site could not be reached';
    return [
      { id: 'site_unreachable', status: 'fail', weight: 0, title: 'We could not load your store', why: 'Agents cannot buy from a page that will not load for them.', evidence: why },
      ...(Object.keys(CHECK_META) as (keyof typeof CHECK_META)[])
        .filter((id) => id !== 'live_agent')
        .map((id) => result(id, 'fail', `Site could not be reached (${why})`)),
    ];
  }
  const html = s.html;
  const checkout = s.checkoutHtml ?? '';
  const checks: CheckResult[] = [];

  const blocked = s.robotsTxt ? robotsBlocksAi(s.robotsTxt) : [];
  checks.push(
    result('robots_allows_ai', blocked.length ? 'fail' : 'pass', blocked.length ? `robots.txt blocks: ${blocked.join(', ')}` : s.robotsTxt ? 'robots.txt allows AI agents' : 'No robots.txt (agents allowed by default)'),
  );

  const priced = (ps: any[]) => ps.filter((p) => {
    const o = Array.isArray(p.offers) ? p.offers[0] : p.offers;
    return o?.price && o?.priceCurrency;
  });
  const homeProducts = jsonLdProducts(html);
  const pageProducts = homeProducts.length ? [] : jsonLdProducts(s.productHtml ?? '');
  const products = homeProducts.length ? homeProducts : pageProducts;
  const withOffer = priced(products);
  const where = homeProducts.length ? '' : ' on a product page';
  checks.push(
    result('product_jsonld', withOffer.length ? 'pass' : products.length ? 'partial' : 'fail',
      withOffer.length ? `${withOffer.length} product${withOffer.length > 1 ? 's' : ''} with price data${where}`
        : products.length ? `Products found${where} but without price/currency` : 'No schema.org Product data on the home page or a product page'),
  );

  const text = visibleText(html);
  const price = text.match(/\$\s?\d+(?:\.\d{2})?/);
  checks.push(result('server_rendered_prices', price ? 'pass' : 'fail', price ? `Found price "${price[0]}" in page HTML` : 'No prices in the HTML (they load later with JavaScript)'));

  const blocker = html.match(/cookie-wall|cookie-consent-modal|captcha|not a robot|cf-challenge/i) ?? checkout.match(/captcha|not a robot/i);
  checks.push(result('no_blocking_interstitial', blocker ? 'fail' : 'pass', blocker ? `Blocking element found: "${blocker[0]}"` : 'No cookie walls or bot challenges found'));

  const forced = /type=["']password["']/i.test(checkout) || /create an account/i.test(checkout);
  checks.push(result('guest_checkout', !checkout ? 'partial' : forced ? 'fail' : 'pass', !checkout ? 'Could not find a cart/checkout page' : forced ? 'Checkout requires creating an account' : 'Checkout works without an account'));

  const ppPage = /paypal\.com\/sdk\/js|paypal-button|data-paypal/i.test(html + checkout);
  const ppAgent = Array.isArray(s.manifestJson?.checkout?.schemes) && s.manifestJson.checkout.schemes.some((x: unknown) => /paypal/i.test(String(x)));
  checks.push(result('paypal_checkout', ppPage || ppAgent ? 'pass' : 'fail',
    ppPage ? 'PayPal checkout detected' : ppAgent ? 'Agents pay with PayPal through the store’s agent checkout' : 'No PayPal payment option found'));

  const webmcp = /lintel\.js|modelContext\.registerTool/i.test(html);
  checks.push(result('webmcp_tools', webmcp ? 'pass' : 'fail', webmcp ? 'WebMCP tools are registered on the page' : 'No WebMCP tools on the page'));

  const x402 = s.manifestJson?.checkout?.protocol === 'x402';
  checks.push(result('agent_checkout', x402 ? 'pass' : 'fail', x402 ? 'Agent manifest advertises an x402 checkout' : 'No agent manifest with an HTTP checkout'));

  return checks;
}

export function liveAgentCheck(outcome: LiveOutcome, evidence: string): CheckResult {
  const earned = { completed: 30, reached_payment: 20, added_to_cart: 10, found_product: 5, failed: 0, not_run: 0 }[outcome];
  const status = outcome === 'completed' ? 'pass' : earned > 0 ? 'partial' : 'fail';
  const label = {
    completed: 'Agent completed a purchase',
    reached_payment: 'Agent reached payment but did not finish',
    added_to_cart: 'Agent added to cart but could not check out',
    found_product: 'Agent found the product but could not buy it',
    failed: 'Agent could not buy anything',
    not_run: 'Not tested yet — run the agent',
  }[outcome];
  return { id: 'live_agent', status, ...CHECK_META.live_agent, earned, evidence: evidence ? `${label}: ${evidence}` : label };
}
