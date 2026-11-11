/**
 * "Connect with Shopify": OAuth install on the merchant's shop, then the Admin API reads products
 * and adds the Lintel script to the storefront. Scopes: read_products, write_script_tags.
 */
import crypto from 'node:crypto';
import type { Product } from '../ridgelineData';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
const API = '2024-10';
export const SHOPIFY_SCOPES = 'read_products,write_script_tags';

export function normalizeShopDomain(input: string): string {
  let s = input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (s && !s.includes('.')) s = `${s}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(s)) throw new Error('Enter your Shopify store address, like your-store.myshopify.com.');
  return s;
}

export function shopifyAuthorizeUrl(o: { shop: string; apiKey: string; redirectUri: string; state: string }): string {
  const u = new URL(`https://${o.shop}/admin/oauth/authorize`);
  u.search = new URLSearchParams({ client_id: o.apiKey, scope: SHOPIFY_SCOPES, redirect_uri: o.redirectUri, state: o.state }).toString();
  return u.toString();
}

/** Shopify signs callback query strings with the app secret; reject anything that doesn't match. */
export function verifyShopifyHmac(params: URLSearchParams, secret: string): boolean {
  const given = params.get('hmac') ?? '';
  const msg = [...params.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const expected = crypto.createHmac('sha256', secret).update(msg).digest('hex');
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function exchangeShopifyCode(o: { shop: string; code: string; apiKey: string; apiSecret: string; fetchImpl?: FetchLike }): Promise<string> {
  const f = o.fetchImpl ?? fetch;
  const r = await f(`https://${o.shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ client_id: o.apiKey, client_secret: o.apiSecret, code: o.code }),
    signal: AbortSignal.timeout(15_000),
  });
  const b = (await r.json().catch(() => ({}))) as { access_token?: string };
  if (!r.ok || !b.access_token) throw new Error('Shopify didn’t complete the connection. Try again.');
  return b.access_token;
}

async function admin(shop: string, token: string, path: string, f: FetchLike, init: RequestInit = {}) {
  const r = await f(`https://${shop}/admin/api/${API}/${path}`, {
    ...init,
    headers: { 'x-shopify-access-token': token, 'content-type': 'application/json', accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Shopify API ${path} failed (${r.status}).`);
  return r.json();
}

export async function shopifyShopInfo(shop: string, token: string, fetchImpl: FetchLike = fetch) {
  const b = (await admin(shop, token, 'shop.json', fetchImpl)) as { shop: { name: string; email: string; domain: string; shop_owner?: string; currency?: string } };
  return b.shop;
}

const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export async function shopifyAdminProducts(shop: string, token: string, fetchImpl: FetchLike = fetch): Promise<Product[]> {
  const b = (await admin(shop, token, 'products.json?limit=250&status=active', fetchImpl)) as { products: any[] };
  const out: Product[] = [];
  for (const p of b.products ?? []) {
    for (const v of p.variants ?? []) {
      const n = Number(v.price);
      if (!Number.isFinite(n)) continue;
      const variant = v.title && v.title !== 'Default Title' ? ` — ${v.title}` : '';
      const tracked = typeof v.inventory_quantity === 'number' && v.inventory_management !== null;
      out.push({
        sku: String(v.sku || `${p.id}-${v.id}`), title: `${p.title}${variant}`.slice(0, 200), description: strip(String(p.body_html ?? '')).slice(0, 1000),
        price: n.toFixed(2), currency: 'USD', attributes: {}, inStock: tracked ? v.inventory_quantity > 0 || v.inventory_policy === 'continue' : true,
      });
    }
  }
  return out.slice(0, 2000);
}

/** Adds the Lintel script to every storefront page, once. */
export async function installShopifyScriptTag(shop: string, token: string, src: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const existing = (await admin(shop, token, `script_tags.json?src=${encodeURIComponent(src)}`, fetchImpl)) as { script_tags: unknown[] };
  if (existing.script_tags?.length) return;
  await admin(shop, token, 'script_tags.json', fetchImpl, { method: 'POST', body: JSON.stringify({ script_tag: { event: 'onload', src, display_scope: 'online_store' } }) });
}
