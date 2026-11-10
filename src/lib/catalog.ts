import { getDb } from './db';
import type { Product } from './ridgelineData';
export type { Product } from './ridgelineData';
export { RIDGELINE_RAW_CATALOG } from './ridgelineData';

export class CartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartError';
  }
}

export interface CartLine {
  sku: string;
  qty: number;
  unit: string;
  total: string;
}

export interface MerchantRow {
  id: string;
  name: string;
  store_url: string;
  installed: number;
  raw_catalog: string;
  clean_catalog: string | null;
  tool_descriptions: string | null;
}

export function getMerchant(id: string): MerchantRow | undefined {
  return getDb().prepare('select * from merchants where id = ?').get(id) as MerchantRow | undefined;
}

export function getMerchantCatalog(merchantId: string): Product[] {
  const m = getMerchant(merchantId);
  if (!m) return [];
  return JSON.parse(m.clean_catalog ?? m.raw_catalog) as Product[];
}

const toCents = (price: string) => Math.round(Number(price) * 100);
const fromCents = (c: number) => (c / 100).toFixed(2);

export function priceCart(catalog: Product[], items: { sku: string; qty: number }[]) {
  if (!Array.isArray(items) || items.length === 0) throw new CartError('Cart is empty: send items: [{ sku, qty }].');
  let total = 0;
  const lines: CartLine[] = items.map((item) => {
    const product = catalog.find((p) => p.sku === item?.sku);
    if (!product) throw new CartError(`Unknown product SKU: ${String(item?.sku)}`);
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) {
      throw new CartError(`Quantity for ${item.sku} must be a whole number from 1 to 20.`);
    }
    const lineCents = toCents(product.price) * item.qty;
    total += lineCents;
    return { sku: item.sku, qty: item.qty, unit: product.price, total: fromCents(lineCents) };
  });
  return { amount: fromCents(total), lines };
}
