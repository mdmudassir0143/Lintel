import { getMerchant, getMerchantCatalog } from '@/lib/catalog';

export const MERCHANT_ID = 'ridgeline';

export function storeState() {
  const m = getMerchant(MERCHANT_ID);
  return { installed: m?.installed === 1, name: m?.name ?? 'Ridgeline Coffee Roasters', catalog: getMerchantCatalog(MERCHANT_ID) };
}
