import { getMerchant, getMerchantCatalog, priceCart, CartError } from './catalog';
import type { PayPalApi } from './paypal/client';
import {
  createPaymentRequired, verifyAndSettle, encodeHeader, storedRequirement, decodeHeader,
  type CartItem, type PaymentPayload,
} from './x402/paypalScheme';

/** CORS so lintel.js can call these endpoints from a merchant's own domain. */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, PAYMENT-SIGNATURE, X-Lintel-Run',
  'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...CORS_HEADERS, ...headers } });

function installedMerchant(id: string) {
  const m = getMerchant(id);
  return m && m.installed === 1 ? m : null;
}

const notInstalled = () => json({ error: 'not_installed' }, 404);

export function handleManifest(merchantId: string, base: string): Response {
  const m = installedMerchant(merchantId);
  if (!m) return notInstalled();
  const root = `${base}/m/${merchantId}/agent`;
  return json({
    name: m.name,
    description: `${m.name} sells products to AI agents. Browse the catalog, then POST a cart to checkout; payment uses x402 settled through PayPal.`,
    catalog: `${root}/catalog`,
    checkout: { url: `${root}/checkout`, method: 'POST', protocol: 'x402', x402Version: 2, schemes: ['paypal-order'] },
    webmcp: true,
  });
}

export function handleCatalog(merchantId: string): Response {
  if (!installedMerchant(merchantId)) return notInstalled();
  return json({ products: getMerchantCatalog(merchantId) });
}

export async function handleCheckout(req: Request, merchantId: string, deps: { paypal: PayPalApi }): Promise<Response> {
  const m = installedMerchant(merchantId);
  if (!m) return notInstalled();

  let items: CartItem[];
  let priced;
  try {
    const body = await req.json().catch(() => {
      throw new CartError('Body must be JSON: { "items": [{ "sku": "...", "qty": 1 }] }');
    });
    items = body?.items;
    priced = priceCart(getMerchantCatalog(merchantId), items);
  } catch (e) {
    if (e instanceof CartError) return json({ error: e.message }, 400);
    throw e;
  }

  const header = req.headers.get('PAYMENT-SIGNATURE');
  if (!header) {
    const required = await createPaymentRequired({
      paypal: deps.paypal,
      merchantId,
      amount: priced.amount,
      items,
      resource: req.url,
      description: `${m.name} order: ${priced.lines.map((l) => `${l.qty}x ${l.sku}`).join(', ')}`,
    });
    return json(required, 402, { 'PAYMENT-REQUIRED': encodeHeader(required) });
  }

  const result = await verifyAndSettle({
    paypal: deps.paypal,
    merchantId,
    items,
    amount: priced.amount,
    header,
    runId: req.headers.get('X-Lintel-Run') ?? undefined,
  });
  if (!result.ok) {
    if (result.error === 'payment_not_approved') {
      let nonce = '';
      try {
        nonce = decodeHeader<PaymentPayload>(header).payload.nonce;
      } catch {}
      const stored = storedRequirement(nonce);
      if (stored) {
        const body = { ...stored, error: 'payment_not_approved' };
        return json(body, 402, { 'PAYMENT-REQUIRED': encodeHeader(body) });
      }
    }
    return json({ error: result.error }, result.httpStatus);
  }
  return json(
    { status: 'paid', paypalOrderId: result.receipt.paypalOrderId, captureId: result.receipt.transaction, amount: result.receipt.amount, lines: priced.lines },
    200,
    { 'PAYMENT-RESPONSE': encodeHeader(result.receipt) },
  );
}
