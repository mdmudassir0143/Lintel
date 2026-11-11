import { requireStore } from '@/lib/server/session';
import { importShopifyCatalog, importJsonLdCatalog, importWooCommerceCatalog, crawlSitemapCatalog, parseCatalogCsv, setCatalog, getStore, StoreError } from '@/lib/stores';
import { guardedFetch, UnsafeUrlError, trustedHosts } from '@/lib/net';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Imports products: { source: 'shopify' | 'woocommerce' | 'sitemap' | 'page' } | { source: 'csv', csv }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireStore(id, req);
  if (g instanceof Response) return g;
  if (g.store.owner_id == null) return Response.json({ error: 'The demo store’s catalog can’t be replaced.' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  try {
    let products;
    if (b.source === 'shopify') products = await importShopifyCatalog(g.store.store_url);
    else if (b.source === 'woocommerce') products = await importWooCommerceCatalog(g.store.store_url);
    else if (b.source === 'sitemap') products = await crawlSitemapCatalog(g.store.store_url);
    else if (b.source === 'page') {
      const r = await guardedFetch(g.store.store_url, {}, { allowHosts: trustedHosts() });
      products = importJsonLdCatalog(await r.text());
      if (!products.length) throw new StoreError('No product data found on your homepage. Try Shopify import or paste a CSV.');
    } else if (b.source === 'csv') products = parseCatalogCsv(String(b.csv ?? ''));
    else return Response.json({ error: 'Choose an import source.' }, { status: 400 });
    setCatalog(id, products);
    return Response.json({ imported: products.length, products: JSON.parse(getStore(id)!.raw_catalog) });
  } catch (e) {
    if (e instanceof StoreError || e instanceof UnsafeUrlError) return Response.json({ error: e.message }, { status: 400 });
    return Response.json({ error: 'We couldn’t reach your store to import products. Paste a CSV instead.' }, { status: 502 });
  }
}
