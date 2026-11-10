import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, resetDbForTests } from '@/lib/db';
import { priceCart, getMerchantCatalog, CartError, RIDGELINE_RAW_CATALOG } from '@/lib/catalog';

describe('catalog', () => {
  beforeEach(() => resetDbForTests());

  it('seeds ridgeline raw catalog with six products', () => {
    const cat = getMerchantCatalog('ridgeline');
    expect(cat.map((p) => p.sku)).toEqual(['RC-HB12', 'RC-ETH12', 'RC-COL12', 'RC-DEC12', 'RC-ESP2', 'RC-KIT1']);
    expect(cat.find((p) => p.sku === 'RC-ETH12')!.title).toBe('ETH YIRG 12OZ - NAT');
  });

  it('priceCart sums in cents', () => {
    const r = priceCart(RIDGELINE_RAW_CATALOG, [{ sku: 'RC-ETH12', qty: 1 }, { sku: 'RC-HB12', qty: 2 }]);
    expect(r.amount).toBe('58.00');
    expect(r.lines).toEqual([
      { sku: 'RC-ETH12', qty: 1, unit: '22.00', total: '22.00' },
      { sku: 'RC-HB12', qty: 2, unit: '18.00', total: '36.00' },
    ]);
  });

  it('priceCart rejects bad carts', () => {
    const bad: unknown[] = [
      [],
      [{ sku: 'NOPE', qty: 1 }],
      [{ sku: 'RC-ETH12', qty: 0 }],
      [{ sku: 'RC-ETH12', qty: -1 }],
      [{ sku: 'RC-ETH12', qty: 21 }],
      [{ sku: 'RC-ETH12', qty: 1.5 }],
      [{ sku: 'RC-ETH12', qty: '1' }],
      'not an array',
    ];
    for (const items of bad) expect(() => priceCart(RIDGELINE_RAW_CATALOG, items as any)).toThrow(CartError);
  });

  it('getMerchantCatalog prefers clean catalog', () => {
    const clean = [{ ...RIDGELINE_RAW_CATALOG[1], title: 'Ethiopia Yirgacheffe' }];
    getDb().prepare('update merchants set clean_catalog = ? where id = ?').run(JSON.stringify(clean), 'ridgeline');
    expect(getMerchantCatalog('ridgeline')[0].title).toBe('Ethiopia Yirgacheffe');
  });
});
