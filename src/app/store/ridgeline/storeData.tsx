import { getMerchant, getMerchantCatalog } from '@/lib/catalog';

export const MERCHANT_ID = 'ridgeline';

export function storeState() {
  const m = getMerchant(MERCHANT_ID);
  const installed = m?.installed === 1;
  // Before Lintel is installed the shop shows its original (messy) catalog.
  const catalog = installed ? getMerchantCatalog(MERCHANT_ID) : (JSON.parse(m?.raw_catalog ?? '[]') as Product[]);
  return { installed, name: m?.name ?? 'Ridgeline Coffee Roasters', catalog };
}

import { productJsonLd, jsonForScript } from '@/lib/fixes/generate';
import type { Product } from '@/lib/catalog';

export function JsonLd({ products, storeName }: { products: Product[]; storeName: string }) {
  return products.map((p) => (
    <script key={p.sku} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(productJsonLd(p, storeName)) }} />
  ));
}
