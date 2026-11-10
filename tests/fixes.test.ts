import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests } from '@/lib/db';
import { generateFixes, renderHeadTags, renderProductJsonLd, productJsonLd } from '@/lib/fixes/generate';
import { cleanCatalog } from '@/lib/scan/analyze';
import { RIDGELINE_RAW_CATALOG, type Product } from '@/lib/catalog';
import { scriptedModel, textResult } from './helpers/mockModels';

const eth = RIDGELINE_RAW_CATALOG.find((p) => p.sku === 'RC-ETH12')!;

describe('fix generation', () => {
  beforeEach(() => resetDbForTests());

  it('renderProductJsonLd emits schema.org Product with offer', () => {
    const tag = renderProductJsonLd(eth, 'Ridgeline Coffee Roasters');
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    const json = JSON.parse(tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
    expect(json['@type']).toBe('Product');
    expect(json.sku).toBe('RC-ETH12');
    expect(json.offers).toMatchObject({ '@type': 'Offer', price: '22.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' });
    expect(productJsonLd(eth, 'X').brand.name).toBe('X');
  });

  it('renderHeadTags includes script and manifest link', () => {
    const h = renderHeadTags('https://lintel.app', 'ridgeline');
    expect(h).toContain('<script src="https://lintel.app/lintel.js" data-merchant="ridgeline" data-base="https://lintel.app" async></script>');
    expect(h).toContain('<link rel="agent-manifest" href="https://lintel.app/m/ridgeline/agent/manifest.json">');
  });

  it('generateFixes uses injected deps', async () => {
    const cleaned: Product[] = RIDGELINE_RAW_CATALOG.map((p) => ({ ...p, title: `Clean ${p.sku}` }));
    const bundle = await generateFixes('ridgeline', {
      cleanCatalog: async () => cleaned,
      writeToolDescriptions: async () => ({ search_products: 'Search Ridgeline coffees' }),
    });
    expect(bundle.cleanCatalog[1].title).toBe('Clean RC-ETH12');
    expect(bundle.toolDescriptions.search_products).toBe('Search Ridgeline coffees');
    expect(bundle.snippets.jsonLd['RC-ETH12']).toContain('"Product"');
    expect(bundle.snippets.headTags).toContain('lintel.js');
  });

  it('cleanCatalog never changes sku, price or stock', async () => {
    const llmOut = { products: [{ sku: 'RC-ETH12', title: 'Ethiopia Yirgacheffe', description: 'Bright and floral.', price: '1.00', attributes: [{ name: 'origin', value: 'Ethiopia' }, { name: 'process', value: 'Natural' }] }, { sku: 'FAKE', title: 'Invented', description: '', attributes: [] }] };
    const model = scriptedModel([textResult(JSON.stringify(llmOut))]);
    const out = await cleanCatalog([eth], { models: [model] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sku: 'RC-ETH12', title: 'Ethiopia Yirgacheffe', price: '22.00', inStock: true, currency: 'USD' });
    expect(out[0].attributes.origin).toBe('Ethiopia');
  });

  it('cleanCatalog keeps raw product when LLM omits it', async () => {
    const model = scriptedModel([textResult(JSON.stringify({ products: [] }))]);
    const out = await cleanCatalog([eth], { models: [model] });
    expect(out[0].title).toBe(eth.title);
  });
});
