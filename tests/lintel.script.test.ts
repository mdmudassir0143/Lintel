// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'lintel.js'), 'utf8');
const catalog = [
  { sku: 'RC-ETH12', title: 'Ethiopia Yirgacheffe', description: 'Natural process, berry', price: '22.00', currency: 'USD', attributes: { origin: 'Ethiopia' }, inStock: true },
  { sku: 'RC-HB12', title: 'House Blend', description: 'Chocolate, nutty', price: '18.00', currency: 'USD', attributes: {}, inStock: true },
];
const required = { x402Version: 2, accepts: [{ scheme: 'paypal-order', network: 'paypal:sandbox', amount: '22.00', asset: 'USD', extra: { orderId: 'O1', approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=O1', nonce: 'N1' } }] };

function boot(routes: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => routes(String(url), init));
  (globalThis as any).fetch = fetchMock;
  delete (document as any).modelContext;
  delete (window as any).__lintel;
  document.head.innerHTML = '';
  const s = document.createElement('script');
  s.dataset.merchant = 'ridgeline';
  s.dataset.base = 'http://lintel.test';
  s.src = 'http://lintel.test/lintel.js';
  document.head.appendChild(s);
  sessionStorage.clear();
  // eslint-disable-next-line no-eval
  (0, eval)(SRC);
  return { fetchMock, ready: (window as any).__lintel.ready as Promise<void> };
}

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const routes = (url: string) => {
  if (url.endsWith('/agent/config')) return ok({ merchantId: 'ridgeline', base: 'http://lintel.test', tools: [] });
  if (url.endsWith('/agent/catalog')) return ok({ products: catalog });
  if (url.endsWith('/agent/checkout')) return ok(required, 402);
  return ok({ error: 'nf' }, 404);
};

describe('lintel.js', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers six tools via shim', async () => {
    const { ready } = boot(routes);
    await ready;
    const names = (await (document as any).modelContext.getTools()).map((t: any) => t.name);
    expect(names).toEqual(['search_products', 'get_product', 'add_to_cart', 'view_cart', 'checkout_with_paypal', 'confirm_payment']);
    const checkout = (await (document as any).modelContext.getTools()).find((t: any) => t.name === 'checkout_with_paypal');
    expect(checkout.annotations?.consequential).toBe(true);
  });

  it('search is case-insensitive', async () => {
    const { ready } = boot(routes);
    await ready;
    const r = await (document as any).modelContext.executeTool('search_products', { query: 'ethiopia' });
    expect(r.products.map((p: any) => p.sku)).toEqual(['RC-ETH12']);
  });

  it('search matches word forms and spacing: "Ethiopian 12oz" finds Ethiopia … 12 oz', async () => {
    const { ready } = boot((url) => (url.endsWith('/agent/catalog')
      ? ok({ products: [{ ...catalog[0], title: 'Ethiopia Yirgacheffe — Natural Process, 12 oz', attributes: { size: '12 oz' } }, catalog[1]] })
      : routes(url)));
    await ready;
    for (const query of ['Ethiopian', 'Ethiopian coffee 12oz', 'ethiopian 12 oz bag']) {
      const r = await (window as any).__lintel.call('search_products', { query });
      expect(r.products.map((p: any) => p.sku)[0], query).toBe('RC-ETH12');
    }
  });

  it('search ranks partial matches instead of returning nothing', async () => {
    const { ready } = boot(routes);
    await ready;
    const r = await (window as any).__lintel.call('search_products', { query: 'berry espresso pods' });
    expect(r.products.map((p: any) => p.sku)).toEqual(['RC-ETH12']);
  });

  it('checkout returns approval_required on 402', async () => {
    const { ready, fetchMock } = boot(routes);
    await ready;
    await (window as any).__lintel.call('add_to_cart', { sku: 'RC-ETH12', qty: 1 });
    const r = await (document as any).modelContext.executeTool('checkout_with_paypal', {});
    expect(r).toMatchObject({ status: 'approval_required', amount: '22.00', orderId: 'O1', nonce: 'N1' });
    expect(r.approveUrl).toContain('sandbox.paypal.com');
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/agent/checkout'))!;
    expect(JSON.parse(String(call[1]!.body))).toEqual({ items: [{ sku: 'RC-ETH12', qty: 1 }] });
  });

  it('confirm_payment sends PAYMENT-SIGNATURE proof', async () => {
    let seen: string | null = null;
    const { ready } = boot((url, init) => {
      if (url.endsWith('/agent/checkout')) {
        seen = new Headers(init?.headers).get('PAYMENT-SIGNATURE');
        return ok({ status: 'paid', paypalOrderId: 'O1', captureId: 'C1', amount: '22.00' });
      }
      return routes(url);
    });
    await ready;
    await (window as any).__lintel.call('add_to_cart', { sku: 'RC-ETH12' });
    const r = await (window as any).__lintel.call('confirm_payment', { orderId: 'O1', nonce: 'N1' });
    expect(r.status).toBe('paid');
    expect(JSON.parse(atob(seen!))).toEqual({ x402Version: 2, scheme: 'paypal-order', network: 'paypal:sandbox', payload: { orderId: 'O1', nonce: 'N1' } });
    expect((await (window as any).__lintel.call('view_cart', {})).items).toEqual([]);
  });

  it('confirm_payment with no args uses the order from the last checkout', async () => {
    const proofs: string[] = [];
    const { ready } = boot((url, init) => {
      if (url.endsWith('/agent/checkout')) {
        const sig = new Headers(init?.headers).get('PAYMENT-SIGNATURE');
        if (sig) {
          proofs.push(sig);
          return ok({ status: 'paid', paypalOrderId: 'O1', captureId: 'C1', amount: '22.00' });
        }
      }
      return routes(url);
    });
    await ready;
    await (window as any).__lintel.call('add_to_cart', { sku: 'RC-ETH12', qty: 1 });
    await (window as any).__lintel.call('checkout_with_paypal', {});
    const r = await (window as any).__lintel.call('confirm_payment', {});
    expect(r.status).toBe('paid');
    expect(JSON.parse(atob(proofs[0])).payload).toEqual({ orderId: 'O1', nonce: 'N1' });
  });

  it('add_to_cart rejects unknown sku', async () => {
    const { ready } = boot(routes);
    await ready;
    const r = await (window as any).__lintel.call('add_to_cart', { sku: 'NOPE', qty: 1 });
    expect(r.error).toMatch(/unknown/i);
  });
});
