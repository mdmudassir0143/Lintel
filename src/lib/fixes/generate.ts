import { getMerchant, getMerchantCatalog, type Product } from '../catalog';
import { env } from '../env';
import { getDb } from '../db';

export interface FixBundle {
  cleanCatalog: Product[];
  toolDescriptions: Record<string, string>;
  snippets: { headTags: string; jsonLd: Record<string, string> };
}

export interface FixDeps {
  cleanCatalog(raw: Product[]): Promise<Product[]>;
  writeToolDescriptions(storeName: string, catalog: Product[]): Promise<Record<string, string>>;
}

export function renderHeadTags(base: string, merchantId: string): string {
  return [
    `<script src="${base}/lintel.js" data-merchant="${merchantId}" data-base="${base}" async></script>`,
    `<link rel="agent-manifest" href="${base}/m/${merchantId}/agent/manifest.json">`,
  ].join('\n');
}

export function productJsonLd(p: Product, storeName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    sku: p.sku,
    name: p.title,
    description: p.description,
    brand: { '@type': 'Brand', name: storeName },
    additionalProperty: Object.entries(p.attributes).map(([name, value]) => ({ '@type': 'PropertyValue', name, value })),
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: p.currency,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}

/** JSON for embedding inside a <script> tag ("<" escaped so content can't close the tag). */
export function jsonForScript(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function renderProductJsonLd(p: Product, storeName: string): string {
  return `<script type="application/ld+json">${jsonForScript(productJsonLd(p, storeName))}</script>`;
}

export async function generateFixes(merchantId: string, deps: FixDeps): Promise<FixBundle> {
  const m = getMerchant(merchantId);
  if (!m) throw new Error(`Unknown merchant ${merchantId}`);
  const raw = JSON.parse(m.raw_catalog) as Product[];
  const cleanCatalog = await deps.cleanCatalog(raw);
  const toolDescriptions = await deps.writeToolDescriptions(m.name, cleanCatalog);
  return {
    cleanCatalog,
    toolDescriptions,
    snippets: {
      headTags: renderHeadTags(env.publicBaseUrl, merchantId),
      jsonLd: Object.fromEntries(cleanCatalog.map((p) => [p.sku, renderProductJsonLd(p, m.name)])),
    },
  };
}

export function saveFixes(merchantId: string, bundle: FixBundle) {
  getDb()
    .prepare('update merchants set clean_catalog = ?, tool_descriptions = ?, installed = 1 where id = ?')
    .run(JSON.stringify(bundle.cleanCatalog), JSON.stringify(bundle.toolDescriptions), merchantId);
}

/** Current bundle from stored data (no AI calls) — for showing snippets after install. */
export function currentBundle(merchantId: string): FixBundle | null {
  const m = getMerchant(merchantId);
  if (!m?.clean_catalog) return null;
  const cleanCatalog = getMerchantCatalog(merchantId);
  return {
    cleanCatalog,
    toolDescriptions: JSON.parse(m.tool_descriptions ?? '{}'),
    snippets: {
      headTags: renderHeadTags(env.publicBaseUrl, merchantId),
      jsonLd: Object.fromEntries(cleanCatalog.map((p) => [p.sku, renderProductJsonLd(p, m.name)])),
    },
  };
}
