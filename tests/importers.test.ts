import { describe, it, expect } from 'vitest';
import { detectPlatform, importWooCommerceCatalog, crawlSitemapCatalog, parseCatalogCsv } from '@/lib/stores';

const res = (body: string, type = 'text/html', status = 200) => new Response(body, { status, headers: { 'content-type': type } });

describe('detectPlatform', () => {
  it.each([
    ['<link href="https://cdn.shopify.com/s/files/x.css">', 'shopify'],
    ['<script src="/wp-content/plugins/woocommerce/assets/js/x.js">', 'woocommerce'],
    ['<img src="https://static.wixstatic.com/media/a.jpg">', 'wix'],
    ['<link href="https://static1.squarespace.com/static/x.css">', 'squarespace'],
    ['<script src="https://cdn11.bigcommerce.com/s-abc/x.js">', 'bigcommerce'],
    ['<html data-wf-site="123">', 'webflow'],
    ['<html><body>hand made</body></html>', 'other'],
  ])('%s -> %s', (html, platform) => expect(detectPlatform(html)).toBe(platform));
});

describe('WooCommerce import', () => {
  it('reads the public Store API with minor-unit prices', async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      return res(JSON.stringify([
        { id: 7, name: 'Kenya AA &amp; Co', sku: 'KEN', short_description: '<p>Juicy</p>', prices: { price: '2100', currency_minor_unit: 2 }, is_in_stock: true },
        { id: 8, name: 'Mug', sku: '', short_description: '', prices: { price: '1200', currency_minor_unit: 2 }, is_in_stock: false },
      ]), 'application/json');
    };
    const out = await importWooCommerceCatalog('https://shop.test/', fetchImpl as any);
    expect(calls[0]).toBe('https://shop.test/wp-json/wc/store/v1/products?per_page=100');
    expect(out).toEqual([
      { sku: 'KEN', title: 'Kenya AA & Co', description: 'Juicy', price: '21.00', currency: 'USD', attributes: {}, inStock: true },
      { sku: 'woo-8', title: 'Mug', description: '', price: '12.00', currency: 'USD', attributes: {}, inStock: false },
    ]);
  });
});

describe('sitemap crawl', () => {
  it('follows the sitemap to product pages and reads their product data', async () => {
    const pages: Record<string, string> = {
      'https://shop.test/sitemap.xml': '<sitemapindex><sitemap><loc>https://shop.test/sitemap-products.xml</loc></sitemap><sitemap><loc>https://shop.test/sitemap-blog.xml</loc></sitemap></sitemapindex>',
      'https://shop.test/sitemap-products.xml': '<urlset><url><loc>https://shop.test/products/tea</loc></url><url><loc>https://shop.test/products/kettle</loc></url><url><loc>https://shop.test/about</loc></url></urlset>',
      'https://shop.test/products/tea': '<script type="application/ld+json">{"@type":"Product","sku":"T1","name":"Tea","offers":{"price":"9"}}</script>',
      'https://shop.test/products/kettle': '<script type="application/ld+json">{"@type":"Product","sku":"K1","name":"Kettle","offers":{"price":"40","availability":"OutOfStock"}}</script>',
    };
    const seen: string[] = [];
    const fetchImpl = async (url: string) => { seen.push(url); return pages[url] ? res(pages[url]) : res('nf', 'text/plain', 404); };
    const out = await crawlSitemapCatalog('https://shop.test', fetchImpl as any);
    expect(out.map((p) => [p.sku, p.price, p.inStock])).toEqual([['T1', '9.00', true], ['K1', '40.00', false]]);
    expect(seen).not.toContain('https://shop.test/sitemap-blog.xml');
    expect(seen).not.toContain('https://shop.test/about');
  });
});

describe('platform CSV exports', () => {
  it('reads a Shopify product export, including variant rows without a title', () => {
    const csv = [
      'Handle,Title,Body (HTML),Vendor,Variant SKU,Variant Price,Variant Inventory Qty',
      'kenya-aa,Kenya AA,<p>Bright</p>,Ridge,KEN-12,21.00,5',
      'kenya-aa,,,,KEN-2LB,58.00,0',
    ].join('\n');
    expect(parseCatalogCsv(csv).map((p) => [p.sku, p.title, p.description, p.price, p.inStock])).toEqual([
      ['KEN-12', 'Kenya AA', 'Bright', '21.00', true],
      ['KEN-2LB', 'Kenya AA', 'Bright', '58.00', false],
    ]);
  });

  it('reads a WooCommerce export', () => {
    const csv = 'ID,Type,SKU,Name,Short description,In stock?,Regular price\n12,simple,SEN,Sencha,Grassy,1,14\n13,simple,OOL,Oolong,,0,18.5';
    expect(parseCatalogCsv(csv).map((p) => [p.sku, p.title, p.price, p.inStock])).toEqual([['SEN', 'Sencha', '14.00', true], ['OOL', 'Oolong', '18.50', false]]);
  });

  it('reads a BigCommerce export', () => {
    const csv = 'Item Type,Product Name,Product Code/SKU,Price,Product Description,Current Stock Level\nProduct,Pour-over Kit,PO-1,24.99,Glass dripper,3';
    expect(parseCatalogCsv(csv)).toEqual([{ sku: 'PO-1', title: 'Pour-over Kit', description: 'Glass dripper', price: '24.99', currency: 'USD', attributes: {}, inStock: true }]);
  });

  it('reads Wix and Squarespace stock words', () => {
    expect(parseCatalogCsv('handleId,name,sku,price,inventory\nh1,Tea,T1,5,InStock\nh2,Pot,P1,9,OutOfStock').map((p) => p.inStock)).toEqual([true, false]);
    expect(parseCatalogCsv('Title,SKU,Price,Stock\nTea,T1,5,Unlimited').map((p) => p.inStock)).toEqual([true]);
  });
});
