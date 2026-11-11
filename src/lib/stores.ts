/**
 * Merchant stores: ownership, catalog import, install verification and setup progress.
 * A store is a row in `merchants`. The Ridgeline demo store has no owner and is shared.
 */
import crypto from 'node:crypto';
import { getDb } from './db';
import type { MerchantRow } from './catalog';
import type { Product } from './ridgelineData';
import type { User } from './auth';
import { guardedFetch } from './net';
import { env } from './env';

export const DEMO_STORE_ID = 'ridgeline';

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

export function getStore(id: string): MerchantRow | undefined {
  return getDb().prepare('select * from merchants where id = ?').get(id) as MerchantRow | undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeStoreUrl(input: string): string {
  const raw = input.trim();
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new StoreError('Enter your store’s web address, like yourstore.com.');
  }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.') && u.hostname !== 'localhost') {
    throw new StoreError('Enter your store’s web address, like yourstore.com.');
  }
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

function slug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'store';
}

export function createStore(owner: User, input: { name: string; url: string; paypalEmail?: string }): MerchantRow {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new StoreError('Enter your store’s name.');
  const url = normalizeStoreUrl(input.url);
  const paypalEmail = input.paypalEmail?.trim().toLowerCase() || null;
  if (paypalEmail && !EMAIL.test(paypalEmail)) throw new StoreError('Enter the email of your PayPal business account.');
  const db = getDb();
  let id = slug(name);
  while (db.prepare('select 1 from merchants where id = ?').get(id)) id = `${slug(name)}-${crypto.randomBytes(2).toString('hex')}`;
  db.prepare(
    `insert into merchants (id, name, store_url, installed, raw_catalog, owner_id, paypal_email, created_at) values (?, ?, ?, 0, '[]', ?, ?, ?)`,
  ).run(id, name, url, owner.id, paypalEmail, Date.now());
  return getStore(id)!;
}

export function updateStorePaypal(id: string, paypalEmail: string): void {
  const email = paypalEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new StoreError('Enter the email of your PayPal business account.');
  getDb().prepare('update merchants set paypal_email = ?, paypal_verified_at = null where id = ?').run(email, id);
}

export function listStoresFor(user: User): MerchantRow[] {
  const db = getDb();
  if (user.role === 'admin') return db.prepare('select * from merchants order by created_at desc').all() as MerchantRow[];
  return db.prepare('select * from merchants where owner_id = ? or owner_id is null order by owner_id is null, created_at desc').all(user.id) as MerchantRow[];
}

/** Owners and admins manage a store; any signed-in user may use the shared demo store. */
export function canAccessStore(user: User | null, store: MerchantRow): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (store.owner_id == null) return true;
  return store.owner_id === user.id;
}

// ---------------------------------------------------------------------------
// Catalog import
// ---------------------------------------------------------------------------

const money = (v: unknown): string | null => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 && String(v ?? '').trim() !== '' ? n.toFixed(2) : null;
};
const stripHtml = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const product = (sku: string, title: string, description: string, price: string, inStock: boolean): Product => ({
  sku, title, description, price, currency: 'USD', attributes: {}, inStock,
});

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** CSV with a header row: sku, title, price required; description and in_stock optional. */
export function parseCatalogCsv(text: string): Product[] {
  const rows = csvRows(text.trim());
  if (rows.length < 2) throw new StoreError('Add a header row and at least one product.');
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iSku = col('sku', 'id'), iTitle = col('title', 'name'), iPrice = col('price');
  const iDesc = col('description', 'desc'), iStock = col('in_stock', 'instock', 'stock', 'available');
  for (const [i, n] of [[iSku, 'sku'], [iTitle, 'title'], [iPrice, 'price']] as const) {
    if (i < 0) throw new StoreError(`The CSV needs a "${n}" column.`);
  }
  const seen = new Set<string>();
  return rows.slice(1).slice(0, 2000).map((r, k) => {
    const line = k + 2;
    const sku = (r[iSku] ?? '').trim();
    const title = (r[iTitle] ?? '').trim();
    const price = money(r[iPrice]);
    if (!sku || !title) throw new StoreError(`Line ${line}: sku and title are required.`);
    if (price === null) throw new StoreError(`Line ${line}: "${r[iPrice] ?? ''}" is not a price.`);
    if (seen.has(sku)) throw new StoreError(`Line ${line}: sku ${sku} appears twice.`);
    seen.add(sku);
    const stock = iStock < 0 ? 'yes' : (r[iStock] ?? '').trim().toLowerCase();
    return product(sku, title.slice(0, 200), (iDesc < 0 ? '' : r[iDesc] ?? '').trim().slice(0, 1000), price, !['no', 'false', '0', 'out', 'out of stock'].includes(stock));
  });
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
const ownHosts = () => [new URL(env.publicBaseUrl).host];
const defaultFetch: FetchLike = (url, init) => guardedFetch(url, init, { allowHosts: ownHosts() });

/** Shopify stores publish their catalog at /products.json. */
export async function importShopifyCatalog(storeUrl: string, fetchImpl: FetchLike = defaultFetch): Promise<Product[]> {
  const origin = new URL(normalizeStoreUrl(storeUrl)).origin;
  const r = await fetchImpl(`${origin}/products.json?limit=250`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new StoreError('This doesn’t look like a Shopify store. Paste a CSV instead.');
  const body = (await r.json().catch(() => null)) as { products?: any[] } | null;
  if (!Array.isArray(body?.products) || !body!.products.length) throw new StoreError('No products found at /products.json.');
  const out: Product[] = [];
  for (const p of body!.products) {
    for (const v of p.variants ?? []) {
      const price = money(v.price);
      if (price === null) continue;
      const variant = v.title && v.title !== 'Default Title' ? ` — ${v.title}` : '';
      out.push(product(String(v.sku || `${p.id}-${v.id}`), `${p.title}${variant}`.slice(0, 200), stripHtml(String(p.body_html ?? '')).slice(0, 1000), price, v.available !== false));
    }
  }
  return out.slice(0, 2000);
}

/** schema.org Product data already on a page. */
export function importJsonLdCatalog(html: string): Product[] {
  const out: Product[] = [];
  const visit = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visit);
    if (n['@graph']) visit(n['@graph']);
    const types = [].concat(n['@type'] ?? []);
    if (types.includes('Product' as never)) {
      const offer = [].concat(n.offers ?? [])[0] as any;
      const price = money(offer?.price ?? offer?.lowPrice);
      const sku = String(n.sku ?? n.productID ?? '').trim();
      if (sku && n.name && price !== null) {
        out.push(product(sku, String(n.name).slice(0, 200), stripHtml(String(n.description ?? '')).slice(0, 1000), price, !/OutOfStock/i.test(String(offer?.availability ?? ''))));
      }
    }
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1])); } catch { /* skip malformed blocks */ }
  }
  return out;
}

export function setCatalog(id: string, products: Product[]): void {
  if (!products.length) throw new StoreError('No products to import.');
  getDb().prepare('update merchants set raw_catalog = ?, clean_catalog = null, tool_descriptions = null where id = ?').run(JSON.stringify(products), id);
}

// ---------------------------------------------------------------------------
// Install verification and setup progress
// ---------------------------------------------------------------------------

export async function verifyInstall(id: string, fetchImpl: FetchLike = defaultFetch): Promise<{ ok: boolean; message: string }> {
  const s = getStore(id);
  if (!s) throw new StoreError('Unknown store.');
  let html = '';
  try {
    const r = await fetchImpl(s.store_url, { headers: { 'user-agent': 'LintelVerify/1.0' } });
    html = await r.text();
  } catch {
    return { ok: false, message: `We couldn’t load ${s.store_url}. Check that it’s online.` };
  }
  const tags = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  const found = tags.some((t) => /lintel\.js/.test(t) && new RegExp(`data-merchant=["']${id}["']`).test(t));
  if (!found) return { ok: false, message: 'We didn’t find the Lintel snippet on your homepage yet. Paste it into the <head> and publish.' };
  getDb().prepare('update merchants set install_verified_at = ? where id = ?').run(Date.now(), id);
  return { ok: true, message: 'Snippet found on your store.' };
}

export type SetupStep = { id: 'catalog' | 'rewrite' | 'snippet' | 'paypal' | 'test'; title: string; done: boolean };

export function setupProgress(s: MerchantRow): SetupStep[] {
  const products = JSON.parse(s.raw_catalog || '[]') as unknown[];
  const db = getDb();
  const bought = !!db.prepare("select 1 from orders where merchant_id = ? limit 1").get(s.id) ||
    !!db.prepare("select 1 from runs where merchant_id = ? and status = 'succeeded' limit 1").get(s.id);
  const isDemo = s.owner_id == null;
  return [
    { id: 'catalog', title: 'Import your products', done: products.length > 0 },
    { id: 'rewrite', title: 'Rewrite your catalog for agents', done: s.clean_catalog != null && s.installed === 1 },
    { id: 'snippet', title: 'Add the snippet to your store', done: isDemo ? s.installed === 1 : s.install_verified_at != null },
    { id: 'paypal', title: 'Connect PayPal', done: isDemo || s.paypal_email != null },
    { id: 'test', title: 'Send a test agent', done: bought },
  ];
}

/** What the test agent is asked to buy: the demo coffee for Ridgeline, else the cheapest in-stock product. */
export function agentGoalFor(s: MerchantRow): string {
  if (s.id === DEMO_STORE_ID) return 'Buy one 12 oz bag of Ethiopian coffee for under $25.';
  const products = (JSON.parse(s.clean_catalog ?? s.raw_catalog ?? '[]') as Product[]).filter((p) => p.inStock);
  if (!products.length) return `Buy one product from ${s.name}.`;
  const p = products.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
  return `Buy one “${p.title}” for under $${Math.ceil(Number(p.price) * 1.2)}.`;
}

export interface StoreSummary {
  id: string; name: string; storeUrl: string; isDemo: boolean; installed: boolean; ownerId: string | null;
  paypalEmail: string | null; paypalVerified: boolean; installVerified: boolean; productCount: number;
  latestScore: number | null; latestScanId: string | null; orders: number; revenue: string; createdAt: number | null;
  setup: SetupStep[];
}

export function storeSummary(s: MerchantRow): StoreSummary {
  const db = getDb();
  const scan = db.prepare("select id, score from scans where merchant_id = ? and status = 'done' order by created_at desc limit 1").get(s.id) as { id: string; score: number } | undefined;
  const o = db.prepare('select count(*) n, coalesce(sum(cast(amount as real)), 0) total from orders where merchant_id = ?').get(s.id) as { n: number; total: number };
  return {
    id: s.id, name: s.name, storeUrl: s.store_url, isDemo: s.owner_id == null, installed: s.installed === 1, ownerId: s.owner_id,
    paypalEmail: s.paypal_email, paypalVerified: s.paypal_verified_at != null, installVerified: s.install_verified_at != null,
    productCount: (JSON.parse(s.raw_catalog || '[]') as unknown[]).length,
    latestScore: scan?.score ?? null, latestScanId: scan?.id ?? null, orders: o.n, revenue: o.total.toFixed(2), createdAt: s.created_at,
    setup: setupProgress(s),
  };
}
