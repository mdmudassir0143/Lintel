import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from '@/lib/db';
import { handleCheckout, handleManifest, handleCatalog } from '@/lib/agentEndpoints';
import { fakePaypal } from './helpers/fakePaypal';
import { discover, getCatalog, buy, LintelError } from '../packages/agent/src/index';

const BASE = 'https://lintel.test';
const STORE = 'https://ridgeline.test/';

/** A store page with the Lintel snippet, served next to Lintel's real agent endpoints. */
function world(pp = fakePaypal()) {
  const calls: { url: string; method: string; sig?: string | null }[] = [];
  const fetchImpl = (async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? 'GET', sig: new Headers(init.headers).get('PAYMENT-SIGNATURE') });
    if (url === STORE) {
      return new Response(`<html><head><link rel="agent-manifest" href="${BASE}/m/ridgeline/agent/manifest.json"></head><body>Shop</body></html>`, { headers: { 'content-type': 'text/html' } });
    }
    if (url.endsWith('/m/ridgeline/agent/manifest.json')) return handleManifest('ridgeline', BASE);
    if (url.endsWith('/m/ridgeline/agent/catalog')) return handleCatalog('ridgeline');
    if (url.endsWith('/m/ridgeline/agent/checkout')) return handleCheckout(new Request(url, init), 'ridgeline', { paypal: pp.api });
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
  return { pp, calls, fetchImpl };
}

beforeEach(() => {
  resetDbForTests();
  getDb().prepare("update merchants set installed = 1 where id = 'ridgeline'").run();
});

describe('@lintel-agent/sdk', () => {
  it('discovers a store from its page and reads the catalog', async () => {
    const { fetchImpl } = world();
    const store = await discover(STORE, { fetch: fetchImpl });
    expect(store).toMatchObject({ name: 'Ridgeline Coffee Roasters', checkout: { url: `${BASE}/m/ridgeline/agent/checkout`, schemes: ['paypal-order'] } });
    const products = await getCatalog(store, { fetch: fetchImpl });
    expect(products.find((p) => p.sku === 'RC-ETH12')).toMatchObject({ price: '22.00' });
  });

  it('accepts a manifest URL directly', async () => {
    const { fetchImpl } = world();
    expect((await discover(`${BASE}/m/ridgeline/agent/manifest.json`, { fetch: fetchImpl })).name).toBe('Ridgeline Coffee Roasters');
  });

  it('buys: asks the person to approve in PayPal, waits, then pays with proof', async () => {
    const { pp, calls, fetchImpl } = world();
    const store = await discover(STORE, { fetch: fetchImpl });
    let asked: { approveUrl: string; amount: string } | null = null;
    const receipt = await buy(store, [{ sku: 'RC-ETH12', qty: 1 }], {
      fetch: fetchImpl,
      pollMs: 1,
      onApprovalRequired: async (r) => {
        asked = r;
        setTimeout(() => pp.approve(r.orderId), 5); // the person approves a moment later
      },
    });
    expect(asked!.amount).toBe('22.00');
    expect(asked!.approveUrl).toContain('sandbox.paypal.com');
    expect(receipt).toMatchObject({ status: 'paid', amount: '22.00', captureId: expect.any(String) });
    expect(pp.counts.capture).toBe(1);
    const proofs = calls.filter((c) => c.url.endsWith('/checkout') && c.sig);
    expect(proofs.length).toBeGreaterThanOrEqual(1);
  });

  it('gives up after the approval timeout without paying', async () => {
    const { pp, fetchImpl } = world();
    const store = await discover(STORE, { fetch: fetchImpl });
    await expect(buy(store, [{ sku: 'RC-ETH12', qty: 1 }], { fetch: fetchImpl, pollMs: 1, timeoutMs: 30, onApprovalRequired: async () => {} }))
      .rejects.toMatchObject({ code: 'approval_timeout' });
    expect(pp.counts.capture).toBe(0);
  });

  it('reports store errors with their code', async () => {
    const { fetchImpl } = world();
    const store = await discover(STORE, { fetch: fetchImpl });
    const err = await buy(store, [{ sku: 'NOPE', qty: 1 }], { fetch: fetchImpl, onApprovalRequired: async () => {} }).catch((e) => e);
    expect(err).toBeInstanceOf(LintelError);
    expect(err.status).toBe(400);
  });

  it('fails clearly when a page has no Lintel agent manifest', async () => {
    const fetchImpl = (async () => new Response('<html><head></head></html>')) as unknown as typeof fetch;
    await expect(discover('https://plain.test/', { fetch: fetchImpl })).rejects.toMatchObject({ code: 'no_manifest' });
  });
});
