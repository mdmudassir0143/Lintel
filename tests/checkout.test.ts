import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, resetDbForTests } from '@/lib/db';
import { handleCheckout, handleManifest, handleCatalog } from '@/lib/agentEndpoints';
import { decodeHeader, encodeHeader, type PaymentRequired } from '@/lib/x402/paypalScheme';
import { fakePaypal } from './helpers/fakePaypal';

const URL_ = 'http://localhost:3000/m/ridgeline/agent/checkout';
const post = (body: string, headers: Record<string, string> = {}) =>
  new Request(URL_, { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });
const eth = JSON.stringify({ items: [{ sku: 'RC-ETH12', qty: 1 }] });

describe('agent endpoints', () => {
  beforeEach(() => {
    resetDbForTests();
    getDb().prepare("update merchants set installed = 1 where id = 'ridgeline'").run();
  });

  it('returns 402 with PAYMENT-REQUIRED header', async () => {
    const pp = fakePaypal();
    const res = await handleCheckout(post(eth), 'ridgeline', { paypal: pp.api });
    expect(res.status).toBe(402);
    const hdr = decodeHeader<PaymentRequired>(res.headers.get('PAYMENT-REQUIRED')!);
    expect(hdr.x402Version).toBe(2);
    expect(hdr.accepts[0].amount).toBe('22.00');
    expect(await res.json()).toEqual(hdr);
  });

  it('rejects invalid carts without creating orders', async () => {
    const pp = fakePaypal();
    const bodies = [
      'not json',
      JSON.stringify({ items: [] }),
      JSON.stringify({ items: [{ sku: 'NOPE', qty: 1 }] }),
      JSON.stringify({ items: [{ sku: 'RC-ETH12', qty: 0 }] }),
      JSON.stringify({ items: [{ sku: 'RC-ETH12', qty: 21 }] }),
      JSON.stringify({}),
    ];
    for (const b of bodies) {
      const res = await handleCheckout(post(b), 'ridgeline', { paypal: pp.api });
      expect(res.status, b).toBe(400);
      expect(typeof (await res.json()).error).toBe('string');
    }
    expect(pp.counts.create).toBe(0);
  });

  it('full flow: approve then pay', async () => {
    const pp = fakePaypal();
    const first = await handleCheckout(post(eth), 'ridgeline', { paypal: pp.api });
    const req = (await first.json()) as PaymentRequired;
    const { orderId, nonce } = req.accepts[0].extra;
    const proof = encodeHeader({ x402Version: 2, scheme: 'paypal-order', network: 'paypal:sandbox', payload: { orderId, nonce } });

    const early = await handleCheckout(post(eth, { 'PAYMENT-SIGNATURE': proof }), 'ridgeline', { paypal: pp.api });
    expect(early.status).toBe(402);
    const earlyBody = await early.json();
    expect(earlyBody.error).toBe('payment_not_approved');
    expect(earlyBody.accepts[0].extra.orderId).toBe(orderId);
    expect(pp.counts.create).toBe(1);

    pp.approve(orderId);
    const paid = await handleCheckout(post(eth, { 'PAYMENT-SIGNATURE': proof }), 'ridgeline', { paypal: pp.api });
    expect(paid.status).toBe(200);
    const body = await paid.json();
    expect(body).toMatchObject({ status: 'paid', paypalOrderId: orderId, captureId: `CAP-${orderId}`, amount: '22.00' });
    expect(decodeHeader<any>(paid.headers.get('PAYMENT-RESPONSE')!).success).toBe(true);
  });

  it('not installed -> 404 everywhere', async () => {
    getDb().prepare("update merchants set installed = 0 where id = 'ridgeline'").run();
    const pp = fakePaypal();
    expect((await handleCheckout(post(eth), 'ridgeline', { paypal: pp.api })).status).toBe(404);
    expect(handleManifest('ridgeline', 'http://x').status).toBe(404);
    expect(handleCatalog('ridgeline').status).toBe(404);
    expect((await handleCheckout(post(eth), 'nobody', { paypal: pp.api })).status).toBe(404);
  });

  it('manifest advertises x402 paypal-order checkout', async () => {
    const res = handleManifest('ridgeline', 'http://x');
    const m = await res.json();
    expect(m.checkout).toEqual({ url: 'http://x/m/ridgeline/agent/checkout', method: 'POST', protocol: 'x402', x402Version: 2, schemes: ['paypal-order'] });
    expect(m.catalog).toBe('http://x/m/ridgeline/agent/catalog');
    expect(m.webmcp).toBe(true);
  });
});
