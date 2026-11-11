import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { resetDbForTests, getDb } from '@/lib/db';
import { createUser } from '@/lib/auth';
import { googleAuthUrl, exchangeGoogleCode, pkcePair } from '@/lib/oauth/google';
import { findOrCreateOAuthUser, OAuthLinkError } from '@/lib/oauth/accounts';
import {
  normalizeShopDomain, shopifyAuthorizeUrl, verifyShopifyHmac, exchangeShopifyCode, shopifyAdminProducts, installShopifyScriptTag,
} from '@/lib/oauth/shopify';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => resetDbForTests());

describe('Google sign-in', () => {
  it('builds an authorization URL with state and a PKCE challenge', () => {
    const { verifier, challenge } = pkcePair();
    expect(challenge).toBe(crypto.createHash('sha256').update(verifier).digest('base64url'));
    const u = new URL(googleAuthUrl({ clientId: 'cid', redirectUri: 'https://l.test/cb', state: 'st', challenge }));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: 'cid', redirect_uri: 'https://l.test/cb', response_type: 'code', scope: 'openid email profile', state: 'st', code_challenge: challenge, code_challenge_method: 'S256' });
  });

  it('exchanges the code and returns the verified profile', async () => {
    const calls: { url: string; body?: string }[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? String(init.body) : undefined });
      if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'AT' });
      return json({ sub: 'g-1', email: 'Maya@Shop.test', email_verified: true, name: 'Maya', picture: 'https://p' });
    };
    const p = await exchangeGoogleCode({ code: 'c', verifier: 'v', redirectUri: 'https://l.test/cb', clientId: 'cid', clientSecret: 's', fetchImpl: fetchImpl as any });
    expect(p).toEqual({ sub: 'g-1', email: 'maya@shop.test', name: 'Maya', avatarUrl: 'https://p' });
    expect(new URLSearchParams(calls[0].body)).toEqual(new URLSearchParams({ code: 'c', client_id: 'cid', client_secret: 's', redirect_uri: 'https://l.test/cb', grant_type: 'authorization_code', code_verifier: 'v' }));
  });

  it('refuses an unverified Google email', async () => {
    const fetchImpl = async (url: string) => (url.includes('token') ? json({ access_token: 'AT' }) : json({ sub: 'g', email: 'x@y.test', email_verified: false }));
    await expect(exchangeGoogleCode({ code: 'c', verifier: 'v', redirectUri: 'r', clientId: 'c', clientSecret: 's', fetchImpl: fetchImpl as any })).rejects.toThrow(/verified/);
  });
});

describe('social accounts', () => {
  it('creates a password-less account, then finds it again by provider id', async () => {
    const u = await findOrCreateOAuthUser({ provider: 'google', sub: 'g-1', email: 'new@shop.test', name: 'New', emailVerified: true });
    expect(u).toMatchObject({ email: 'new@shop.test', role: 'merchant' });
    expect((getDb().prepare('select password_hash from users where id = ?').get(u.id) as any).password_hash).toBe('');
    expect((await findOrCreateOAuthUser({ provider: 'google', sub: 'g-1', email: 'changed@shop.test', name: 'N', emailVerified: true })).id).toBe(u.id);
  });

  it('links Google to an existing email account only when Google verified the email', async () => {
    const existing = await createUser({ email: 'maya@shop.test', name: 'Maya', password: 'longenough1' });
    expect((await findOrCreateOAuthUser({ provider: 'google', sub: 'g-2', email: 'maya@shop.test', name: 'M', emailVerified: true })).id).toBe(existing.id);
    await expect(findOrCreateOAuthUser({ provider: 'google', sub: 'g-3', email: 'maya@shop.test', name: 'M', emailVerified: false })).rejects.toThrow(OAuthLinkError);
  });

  it('never silently links a Shopify store email to an existing account', async () => {
    await createUser({ email: 'owner@shop.test', name: 'O', password: 'longenough1' });
    await expect(findOrCreateOAuthUser({ provider: 'shopify', sub: 'x.myshopify.com', email: 'owner@shop.test', name: 'O', emailVerified: false })).rejects.toThrow(OAuthLinkError);
  });
});

describe('Shopify connect', () => {
  it('accepts only real myshopify.com shop domains', () => {
    expect(normalizeShopDomain('ridge-bean')).toBe('ridge-bean.myshopify.com');
    expect(normalizeShopDomain('https://Ridge-Bean.myshopify.com/admin')).toBe('ridge-bean.myshopify.com');
    for (const bad of ['evil.com', 'x.myshopify.com.evil.com', '-bad.myshopify.com', '', 'a b']) expect(() => normalizeShopDomain(bad), bad).toThrow();
  });

  it('builds the install URL with read_products and write_script_tags', () => {
    const u = new URL(shopifyAuthorizeUrl({ shop: 'a.myshopify.com', apiKey: 'k', redirectUri: 'https://l.test/cb', state: 'st' }));
    expect(u.origin + u.pathname).toBe('https://a.myshopify.com/admin/oauth/authorize');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: 'k', scope: 'read_products,write_script_tags', redirect_uri: 'https://l.test/cb', state: 'st' });
  });

  it('verifies the callback HMAC', () => {
    const params = new URLSearchParams({ code: 'c', shop: 'a.myshopify.com', state: 's', timestamp: '1' });
    const msg = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
    params.set('hmac', crypto.createHmac('sha256', 'secret').update(msg).digest('hex'));
    expect(verifyShopifyHmac(params, 'secret')).toBe(true);
    expect(verifyShopifyHmac(params, 'other')).toBe(false);
    params.set('shop', 'b.myshopify.com');
    expect(verifyShopifyHmac(params, 'secret')).toBe(false);
  });

  it('exchanges the code, reads products, and installs the script tag once', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    let tags: unknown[] = [];
    const fetchImpl = async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET', body: init.body ? String(init.body) : undefined });
      if (url.endsWith('/admin/oauth/access_token')) return json({ access_token: 'shpat_x', scope: 'read_products,write_script_tags' });
      if (url.includes('/products.json')) return json({ products: [{ id: 1, title: 'Kenya AA', body_html: '<p>Juicy</p>', variants: [{ id: 2, sku: 'KEN', title: 'Default Title', price: '21.00', inventory_quantity: 3 }] }] });
      if (url.includes('/script_tags.json') && (init.method ?? 'GET') === 'GET') return json({ script_tags: tags });
      if (url.includes('/script_tags.json')) { tags = [{ id: 9 }]; return json({ script_tag: { id: 9 } }, 201); }
      return json({}, 404);
    };
    expect(await exchangeShopifyCode({ shop: 'a.myshopify.com', code: 'c', apiKey: 'k', apiSecret: 's', fetchImpl: fetchImpl as any })).toBe('shpat_x');
    expect(JSON.parse(calls[0].body!)).toEqual({ client_id: 'k', client_secret: 's', code: 'c' });
    const products = await shopifyAdminProducts('a.myshopify.com', 'shpat_x', fetchImpl as any);
    expect(products).toEqual([{ sku: 'KEN', title: 'Kenya AA', description: 'Juicy', price: '21.00', currency: 'USD', attributes: {}, inStock: true }]);
    await installShopifyScriptTag('a.myshopify.com', 'shpat_x', 'https://l.test/lintel.js?merchant=m', fetchImpl as any);
    await installShopifyScriptTag('a.myshopify.com', 'shpat_x', 'https://l.test/lintel.js?merchant=m', fetchImpl as any);
    expect(calls.filter((c) => c.url.includes('script_tags') && c.method === 'POST')).toHaveLength(1);
  });
});

describe('secrets at rest', () => {
  it('encrypts and decrypts, and refuses tampered data', () => {
    const box = encryptSecret('shpat_secret');
    expect(box).not.toContain('shpat_secret');
    expect(decryptSecret(box)).toBe('shpat_secret');
    const parts = box.split('.');
    parts[2] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });
});
