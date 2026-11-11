import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from '@/lib/db';
import { createUser, type User } from '@/lib/auth';
import {
  createStore, listStoresFor, canAccessStore, getStore, StoreError, parseCatalogCsv, importShopifyCatalog,
  importJsonLdCatalog, setCatalog, verifyInstall, setupProgress,
} from '@/lib/stores';
import { createPaymentRequired } from '@/lib/x402/paypalScheme';
import { fakePaypal } from './helpers/fakePaypal';

let alice: User, bob: User, admin: User;

beforeEach(async () => {
  resetDbForTests();
  process.env.ADMIN_EMAILS = 'admin@lintel.test';
  alice = await createUser({ email: 'alice@shop.test', name: 'Alice', password: 'longenough1' });
  bob = await createUser({ email: 'bob@shop.test', name: 'Bob', password: 'longenough1' });
  admin = await createUser({ email: 'admin@lintel.test', name: 'Admin', password: 'longenough1' });
});

const htmlResponse = (html: string) => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

describe('stores', () => {
  it('creates a store owned by the user with a unique id and normalized URL', () => {
    const s = createStore(alice, { name: 'Blue Bottle Beans', url: 'bluebeans.test/', paypalEmail: 'pay@bluebeans.test' });
    expect(s).toMatchObject({ name: 'Blue Bottle Beans', store_url: 'https://bluebeans.test', owner_id: alice.id, paypal_email: 'pay@bluebeans.test', installed: 0 });
    expect(s.id).toMatch(/^blue-bottle-beans/);
    const s2 = createStore(bob, { name: 'Blue Bottle Beans', url: 'https://other.test' });
    expect(s2.id).not.toBe(s.id);
  });

  it('rejects invalid input', () => {
    expect(() => createStore(alice, { name: '', url: 'x.test' })).toThrow(StoreError);
    expect(() => createStore(alice, { name: 'A', url: 'not a url' })).toThrow(/address/);
    expect(() => createStore(alice, { name: 'A', url: 'ftp://x.test' })).toThrow(/address/);
    expect(() => createStore(alice, { name: 'A', url: 'a.test', paypalEmail: 'nope' })).toThrow(/PayPal/);
  });

  it('owners see their stores plus the shared demo; admins see everything', () => {
    const a = createStore(alice, { name: 'Alice Shop', url: 'alice.test' });
    createStore(bob, { name: 'Bob Shop', url: 'bob.test' });
    expect(listStoresFor(alice).map((s) => s.id).sort()).toEqual([a.id, 'ridgeline'].sort());
    expect(listStoresFor(admin)).toHaveLength(3);
    expect(canAccessStore(alice, getStore(a.id)!)).toBe(true);
    expect(canAccessStore(bob, getStore(a.id)!)).toBe(false);
    expect(canAccessStore(admin, getStore(a.id)!)).toBe(true);
    expect(canAccessStore(bob, getStore('ridgeline')!)).toBe(true);
    expect(canAccessStore(null, getStore('ridgeline')!)).toBe(false);
  });
});

describe('catalog import', () => {
  it('parses CSV with a header, quotes and stock column', () => {
    const csv = 'sku,title,description,price,in_stock\nA1,"Kenya AA, 12 oz",Bright and juicy,21.5,yes\nA2,Mug,,12,no\n';
    expect(parseCatalogCsv(csv)).toEqual([
      { sku: 'A1', title: 'Kenya AA, 12 oz', description: 'Bright and juicy', price: '21.50', currency: 'USD', attributes: {}, inStock: true },
      { sku: 'A2', title: 'Mug', description: '', price: '12.00', currency: 'USD', attributes: {}, inStock: false },
    ]);
  });

  it('reports the line of a bad CSV row', () => {
    expect(() => parseCatalogCsv('sku,title,price\nA1,Thing,abc')).toThrow(/line 2/i);
    expect(() => parseCatalogCsv('title,price\nThing,1')).toThrow(/sku/);
  });

  it('imports a Shopify store from /products.json', async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      return Response.json({ products: [
        { id: 1, title: 'Kenya AA', body_html: '<p>Bright <b>juicy</b></p>', variants: [{ id: 11, sku: 'KEN-12', title: '12 oz', price: '21.00', available: true }, { id: 12, sku: '', title: '2 lb', price: '58.00', available: false }] },
      ] });
    };
    const products = await importShopifyCatalog('https://shop.test/collections/all', fetchImpl as any);
    expect(calls[0]).toBe('https://shop.test/products.json?limit=250');
    expect(products).toEqual([
      { sku: 'KEN-12', title: 'Kenya AA — 12 oz', description: 'Bright juicy', price: '21.00', currency: 'USD', attributes: {}, inStock: true },
      { sku: '1-12', title: 'Kenya AA — 2 lb', description: 'Bright juicy', price: '58.00', currency: 'USD', attributes: {}, inStock: false },
    ]);
  });

  it('reads schema.org Product data from a page', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","sku":"X1","name":"Tea","description":"Green","offers":{"price":"9.5","availability":"https://schema.org/InStock"}}</script>`;
    expect(importJsonLdCatalog(html)).toEqual([{ sku: 'X1', title: 'Tea', description: 'Green', price: '9.50', currency: 'USD', attributes: {}, inStock: true }]);
  });

  it('setCatalog replaces products and clears the old AI rewrite', () => {
    const s = createStore(alice, { name: 'A', url: 'a.test' });
    getDb().prepare("update merchants set clean_catalog = '[]' where id = ?").run(s.id);
    setCatalog(s.id, parseCatalogCsv('sku,title,price\nA1,Thing,1'));
    const row = getStore(s.id)!;
    expect(JSON.parse(row.raw_catalog)).toHaveLength(1);
    expect(row.clean_catalog).toBeNull();
  });
});

describe('install verification and setup progress', () => {
  it('verifies the snippet on the live store page', async () => {
    const s = createStore(alice, { name: 'A', url: 'a.test' });
    const missing = await verifyInstall(s.id, async () => htmlResponse('<html><head></head></html>'));
    expect(missing).toMatchObject({ ok: false });
    expect(getStore(s.id)!.install_verified_at).toBeNull();
    const ok = await verifyInstall(s.id, async () => htmlResponse(`<head><script src="https://lintel.test/lintel.js" data-merchant="${s.id}" async></script></head>`));
    expect(ok).toMatchObject({ ok: true });
    expect(getStore(s.id)!.install_verified_at).toBeGreaterThan(0);
  });

  it('does not accept a snippet for a different store', async () => {
    const s = createStore(alice, { name: 'A', url: 'a.test' });
    expect(await verifyInstall(s.id, async () => htmlResponse('<script src="/lintel.js" data-merchant="someone-else"></script>'))).toMatchObject({ ok: false });
  });

  it('tracks setup steps in order', () => {
    const s = createStore(alice, { name: 'A', url: 'a.test' });
    expect(setupProgress(getStore(s.id)!).map((x) => [x.id, x.done])).toEqual([
      ['catalog', false], ['rewrite', false], ['snippet', false], ['paypal', false], ['test', false],
    ]);
    setCatalog(s.id, parseCatalogCsv('sku,title,price\nA1,Thing,1'));
    getDb().prepare("update merchants set clean_catalog = '[]', installed = 1, paypal_email = 'p@a.test', paypal_verified_at = 1 where id = ?").run(s.id);
    expect(setupProgress(getStore(s.id)!).filter((x) => x.done).map((x) => x.id)).toEqual(['catalog', 'rewrite', 'paypal']);
  });
});

describe('PayPal account confirmation', () => {
  it('counts the PayPal step done once an email is saved, and confirms it only after a captured payment', async () => {
    const { verifyAndSettle, encodeHeader } = await import('@/lib/x402/paypalScheme');
    const s = createStore(alice, { name: 'A', url: 'a.test', paypalEmail: 'pay@a.test' });
    expect(setupProgress(getStore(s.id)!).find((x) => x.id === 'paypal')!.done).toBe(true);
    expect(getStore(s.id)!.paypal_verified_at).toBeNull();
    const pp = fakePaypal();
    const items = [{ sku: 'A1', qty: 1 }];
    const req = await createPaymentRequired({ paypal: pp.api, merchantId: s.id, amount: '1.00', items, resource: 'r', description: 'd' });
    const { orderId, nonce } = req.accepts[0].extra;
    pp.approve(orderId);
    const header = encodeHeader({ x402Version: 2, scheme: 'paypal-order', network: 'paypal:sandbox', payload: { orderId, nonce } });
    const res = await verifyAndSettle({ paypal: pp.api, merchantId: s.id, items, amount: '1.00', header });
    expect(res.ok).toBe(true);
    expect(getStore(s.id)!.paypal_verified_at).toBeGreaterThan(0);
  });
});

describe('payments go to the merchant', () => {
  it('sets the merchant’s PayPal email as payee on the order', async () => {
    const s = createStore(alice, { name: 'A', url: 'a.test', paypalEmail: 'pay@a.test' });
    const paypal = fakePaypal().api;
    let seen: any;
    const orig = paypal.createOrder.bind(paypal);
    paypal.createOrder = async (input) => { seen = input; return orig(input); };
    await createPaymentRequired({ paypal, merchantId: s.id, amount: '1.00', items: [{ sku: 'A1', qty: 1 }], resource: 'r', description: 'd' });
    expect(seen.payeeEmail).toBe('pay@a.test');
  });
});

describe('test agent goal', () => {
  it('uses the demo goal for Ridgeline and the cheapest in-stock product elsewhere', async () => {
    const { agentGoalFor } = await import('@/lib/stores');
    expect(agentGoalFor(getStore('ridgeline')!)).toMatch(/Ethiopian coffee/);
    const s = createStore(alice, { name: 'A', url: 'a.test' });
    setCatalog(s.id, parseCatalogCsv('sku,title,price,in_stock\nB,Big Kettle,80,yes\nC,Tea Sampler,14.5,yes\nD,Cheap Gone,2,no'));
    expect(agentGoalFor(getStore(s.id)!)).toBe('Buy one “Tea Sampler” for under $18.');
  });
});
