import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, resetDbForTests } from '@/lib/db';
import {
  createPaymentRequired, verifyAndSettle, encodeHeader, decodeHeader, cartHash,
  type PaymentPayload,
} from '@/lib/x402/paypalScheme';
import { fakePaypal } from './helpers/fakePaypal';

const items = [{ sku: 'RC-ETH12', qty: 1 }];
const base = { merchantId: 'ridgeline', amount: '22.00', items, resource: 'http://x/m/ridgeline/agent/checkout', description: 'Ridgeline order' };

function proof(orderId: string, nonce: string): string {
  const p: PaymentPayload = { x402Version: 2, scheme: 'paypal-order', network: 'paypal:sandbox', payload: { orderId, nonce } };
  return encodeHeader(p);
}

describe('x402 paypal-order scheme', () => {
  beforeEach(() => resetDbForTests());

  it('createPaymentRequired returns x402 v2 shape', async () => {
    const pp = fakePaypal();
    const req = await createPaymentRequired({ paypal: pp.api, ...base });
    expect(req.x402Version).toBe(2);
    const a = req.accepts[0];
    expect(a.scheme).toBe('paypal-order');
    expect(a.network).toBe('paypal:sandbox');
    expect(a.amount).toBe('22.00');
    expect(a.asset).toBe('USD');
    expect(a.extra.orderId).toMatch(/^FAKE/);
    expect(a.extra.approveUrl).toContain('sandbox.paypal.com');
    const rows = getDb().prepare('select status, paypal_order_id from payment_nonces').all();
    expect(rows).toEqual([{ status: 'pending', paypal_order_id: a.extra.orderId }]);
  });

  it('header roundtrip', () => {
    const x = { a: 1, b: ['ü', { c: true }] };
    expect(decodeHeader(encodeHeader(x))).toEqual(x);
  });

  it('cartHash is order-independent', () => {
    expect(cartHash([{ sku: 'B', qty: 1 }, { sku: 'A', qty: 2 }])).toBe(cartHash([{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }]));
    expect(cartHash([{ sku: 'A', qty: 1 }])).not.toBe(cartHash([{ sku: 'A', qty: 2 }]));
  });

  it('unapproved order -> 402 payment_not_approved', async () => {
    const pp = fakePaypal();
    const { extra } = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0];
    const r = await verifyAndSettle({ paypal: pp.api, ...base, header: proof(extra.orderId, extra.nonce) });
    expect(r).toEqual({ ok: false, httpStatus: 402, error: 'payment_not_approved' });
    expect(pp.counts.capture).toBe(0);
  });

  it('approved order settles once', async () => {
    const pp = fakePaypal();
    const { extra } = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0];
    pp.approve(extra.orderId);
    const r = await verifyAndSettle({ paypal: pp.api, ...base, header: proof(extra.orderId, extra.nonce) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.firstSettlement).toBe(true);
    expect(r.receipt).toMatchObject({ success: true, network: 'paypal:sandbox', transaction: `CAP-${extra.orderId}`, paypalOrderId: extra.orderId, amount: '22.00' });
    expect(getDb().prepare('select count(*) n from orders').get()).toEqual({ n: 1 });
    expect(getDb().prepare('select status from payment_nonces').get()).toEqual({ status: 'settled' });
  });

  it('replayed proof returns stored receipt without second capture', async () => {
    const pp = fakePaypal();
    const { extra } = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0];
    pp.approve(extra.orderId);
    const h = proof(extra.orderId, extra.nonce);
    const first = await verifyAndSettle({ paypal: pp.api, ...base, header: h });
    const second = await verifyAndSettle({ paypal: pp.api, ...base, header: h });
    expect(second.ok && second.firstSettlement).toBe(false);
    expect(second.ok && second.receipt).toEqual(first.ok && first.receipt);
    expect(pp.counts.capture).toBe(1);
    expect(getDb().prepare('select count(*) n from orders').get()).toEqual({ n: 1 });
  });

  it('cart tampering -> cart_mismatch', async () => {
    const pp = fakePaypal();
    const { extra } = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0];
    pp.approve(extra.orderId);
    const r = await verifyAndSettle({ paypal: pp.api, ...base, items: [{ sku: 'RC-ESP2', qty: 3 }], amount: '114.00', header: proof(extra.orderId, extra.nonce) });
    expect(r).toEqual({ ok: false, httpStatus: 400, error: 'cart_mismatch' });
    expect(pp.counts.capture).toBe(0);
  });

  it('swapped order id -> order_mismatch', async () => {
    const pp = fakePaypal();
    const a = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0].extra;
    const b = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0].extra;
    pp.approve(b.orderId);
    const r = await verifyAndSettle({ paypal: pp.api, ...base, header: proof(b.orderId, a.nonce) });
    expect(r).toEqual({ ok: false, httpStatus: 400, error: 'order_mismatch' });
  });

  it('unknown nonce -> unknown_nonce', async () => {
    const pp = fakePaypal();
    const r = await verifyAndSettle({ paypal: pp.api, ...base, header: proof('FAKE9', 'nope') });
    expect(r).toEqual({ ok: false, httpStatus: 400, error: 'unknown_nonce' });
  });

  it('garbage header -> invalid_payload', async () => {
    const pp = fakePaypal();
    for (const h of ['%%%not-base64', encodeHeader({ hello: 1 }), encodeHeader({ x402Version: 2, scheme: 'exact', network: 'base', payload: {} })]) {
      expect(await verifyAndSettle({ paypal: pp.api, ...base, header: h })).toEqual({ ok: false, httpStatus: 400, error: 'invalid_payload' });
    }
  });
});

describe('review fixes', () => {
  beforeEach(() => resetDbForTests());

  it('settled proof replayed with a different cart is rejected', async () => {
    const pp = fakePaypal();
    const { extra } = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0];
    pp.approve(extra.orderId);
    expect((await verifyAndSettle({ paypal: pp.api, ...base, header: proof(extra.orderId, extra.nonce) })).ok).toBe(true);
    const swapped = await verifyAndSettle({ paypal: pp.api, ...base, items: [{ sku: 'RC-ESP2', qty: 20 }], amount: '760.00', header: proof(extra.orderId, extra.nonce) });
    expect(swapped).toEqual({ ok: false, httpStatus: 400, error: 'cart_mismatch' });
  });

  it('concurrent proofs settle once and write one order row', async () => {
    const pp = fakePaypal();
    const { extra } = (await createPaymentRequired({ paypal: pp.api, ...base })).accepts[0];
    pp.approve(extra.orderId);
    const h = proof(extra.orderId, extra.nonce);
    const [a, b] = await Promise.all([
      verifyAndSettle({ paypal: pp.api, ...base, header: h }),
      verifyAndSettle({ paypal: pp.api, ...base, header: h }),
    ]);
    expect([a, b].filter((r) => r.ok && r.firstSettlement)).toHaveLength(1);
    expect([a, b].every((r) => r.ok)).toBe(true);
    expect(getDb().prepare('select count(*) n from orders').get()).toEqual({ n: 1 });
  });
});
