import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { runStaticChecks, liveAgentCheck, type CheckId, type CheckResult } from '@/lib/scan/checks';
import { fetchSite, type SiteSnapshot } from '@/lib/scan/fetchSite';

const fx = (n: string) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const snap = (mode: 'before' | 'after'): SiteSnapshot => ({
  url: 'http://localhost:3000/store/ridgeline',
  ok: true,
  status: 200,
  html: fx(`${mode}.html`),
  checkoutHtml: fx(`${mode}-checkout.html`),
  robotsTxt: fx(`${mode}-robots.txt`),
  manifestJson: mode === 'after' ? JSON.parse(fx('manifest.json')) : undefined,
});
const byId = (cs: CheckResult[]) => Object.fromEntries(cs.map((c) => [c.id, c])) as Record<CheckId, CheckResult>;
const STATIC: CheckId[] = ['robots_allows_ai', 'product_jsonld', 'server_rendered_prices', 'no_blocking_interstitial', 'guest_checkout', 'paypal_checkout', 'webmcp_tools', 'agent_checkout'];

const servers: http.Server[] = [];
function serve(handler: http.RequestListener): Promise<string> {
  return new Promise((resolve) => {
    const s = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(s.address() as AddressInfo).port}`));
    servers.push(s);
  });
}
afterAll(() => servers.forEach((s) => { s.closeAllConnections?.(); s.close(); }));

describe('static checks', () => {
  it('before fixture fails key checks', () => {
    const c = byId(runStaticChecks(snap('before')));
    for (const id of STATIC) expect(c[id].status, id).toBe('fail');
    expect(c.no_blocking_interstitial.evidence).toMatch(/cookie/i);
  });

  it('after fixture passes', () => {
    const c = byId(runStaticChecks(snap('after')));
    for (const id of STATIC) expect(c[id].status, `${id}: ${c[id].evidence}`).toBe('pass');
    expect(c.site_unreachable).toBeUndefined();
  });

  it('weights sum to 100 with live agent', () => {
    const all = [...runStaticChecks(snap('after')), liveAgentCheck('completed', '')];
    expect(all.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });

  it('every check has plain-English title and why', () => {
    for (const c of runStaticChecks(snap('before'))) {
      expect(c.title.length).toBeGreaterThan(5);
      expect(c.why.length).toBeGreaterThan(10);
    }
  });
});

describe('fetchSite', () => {
  it('unreachable site yields partial scan', async () => {
    const s = await fetchSite('http://127.0.0.1:9', { timeoutMs: 2000, allowHosts: ['127.0.0.1:9'] });
    expect(s.ok).toBe(false);
    const c = byId(runStaticChecks(s));
    expect(c.site_unreachable.status).toBe('fail');
    for (const id of STATIC) expect(c[id].status).toBe('fail');
  });

  it('enforces timeout', async () => {
    const url = await serve(() => { /* never respond */ });
    const t0 = Date.now();
    const s = await fetchSite(url, { timeoutMs: 200, allowHosts: [new URL(url).host] });
    expect(s.ok).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('non-HTML response', async () => {
    const url = await serve((_q, r) => { r.writeHead(200, { 'content-type': 'application/pdf' }); r.end('%PDF'); });
    const s = await fetchSite(url, { allowHosts: [new URL(url).host] });
    expect(s.ok).toBe(false);
    expect(s.error).toMatch(/content type/i);
  });

  it('rejects non-http urls', async () => {
    const s = await fetchSite('file:///etc/passwd');
    expect(s.ok).toBe(false);
  });

  it('follows checkout link, robots and manifest', async () => {
    const url = await serve((q, r) => {
      if (q.url === '/robots.txt') { r.writeHead(200, { 'content-type': 'text/plain' }); return r.end('User-agent: *\nAllow: /\n'); }
      if (q.url === '/m.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"checkout":{"protocol":"x402"}}'); }
      if (q.url === '/cart') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<p>cart page</p>'); }
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      r.end('<html><head><link rel="agent-manifest" href="/m.json"></head><a href="/about">About</a><a href="/cart">Cart</a></html>');
    });
    const s = await fetchSite(url, { allowHosts: [new URL(url).host] });
    expect(s.ok).toBe(true);
    expect(s.checkoutHtml).toContain('cart page');
    expect(s.robotsTxt).toContain('Allow');
    expect(s.manifestJson).toEqual({ checkout: { protocol: 'x402' } });
  });

  it('caps huge pages', async () => {
    const url = await serve((_q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<p>' + 'x'.repeat(3_000_000)); });
    const s = await fetchSite(url, { maxBytes: 100_000, allowHosts: [new URL(url).host] });
    expect(s.ok).toBe(true);
    expect(s.html!.length).toBeLessThanOrEqual(100_000);
  });
});

describe('stores that install the Lintel snippet', () => {
  const plain = (extra: Partial<SiteSnapshot> = {}): SiteSnapshot => ({
    url: 'http://shop.test/', ok: true, status: 200,
    html: '<html><head></head><body><a href="/products/assam">Assam</a> $11</body></html>', ...extra,
  });
  const manifest = { catalog: 'http://lintel.test/m/x/agent/catalog', checkout: { url: 'http://lintel.test/m/x/agent/checkout', protocol: 'x402', x402Version: 2, schemes: ['paypal-order'] } };

  it('counts PayPal as accepted when the agent checkout settles through PayPal', () => {
    const c = byId(runStaticChecks(plain({ manifestJson: manifest })));
    expect(c.paypal_checkout.status).toBe('pass');
    expect(c.paypal_checkout.evidence).toMatch(/PayPal/);
  });

  it('still fails PayPal with no PayPal on the page and no PayPal agent checkout', () => {
    expect(byId(runStaticChecks(plain())).paypal_checkout.status).toBe('fail');
  });

  it('reads Product data from a product page when the home page has none', () => {
    const productHtml = '<script type="application/ld+json">{"@type":"Product","name":"Assam","offers":{"price":"11.00","priceCurrency":"USD"}}</script>';
    const c = byId(runStaticChecks(plain({ productHtml })));
    expect(c.product_jsonld.status).toBe('pass');
    expect(c.product_jsonld.evidence).toMatch(/product page/i);
  });

  it('fetchSite follows one product link and keeps its HTML', async () => {
    const base = await serve((req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(req.url === '/products/assam' ? '<p>assam page</p>' : '<a href="/products/assam">Assam</a>');
    });
    const s = await fetchSite(base + '/', { allowHosts: [new URL(base).host] });
    expect(s.productHtml).toContain('assam page');
  });
});
