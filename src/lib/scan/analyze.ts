import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import { withModelFallback } from '../llm';
import type { Product } from '../catalog';
import type { CheckResult } from './checks';

type Opts = { models?: LanguageModel[] };

const cleanSchema = z.object({
  products: z.array(
    z.object({
      sku: z.string(),
      title: z.string(),
      description: z.string(),
      attributes: z.record(z.string(), z.string()),
    }),
  ),
});

/**
 * AI rewrites titles/descriptions/attributes so agents can match products to requests.
 * SKU, price, currency and stock always come from the merchant's data, never the model.
 */
export async function cleanCatalog(raw: Product[], opts: Opts = {}): Promise<Product[]> {
  const { object } = await withModelFallback(
    (model) =>
      generateObject({
        model,
        maxRetries: 0,
        schema: cleanSchema,
        prompt: `You clean up product catalogs for a small online store so AI shopping agents can understand them.
For each product: write a clear customer-facing title (expand abbreviations, e.g. "ETH YIRG 12OZ - NAT" -> "Ethiopia Yirgacheffe — Natural Process, 12 oz"),
a 1-2 sentence description, and attributes (for coffee: origin, process, roast, size, form, flavor_notes; for equipment: type, includes).
Never invent facts not implied by the data. Keep every sku exactly as given. Do not output prices.
Products:
${JSON.stringify(raw.map(({ sku, title, description }) => ({ sku, title, description })))}`,
      }),
    { models: opts.models },
  );
  const bySku = new Map(object.products.map((p) => [p.sku, p]));
  return raw.map((p) => {
    const c = bySku.get(p.sku);
    if (!c) return p;
    return { ...p, title: c.title || p.title, description: c.description || p.description, attributes: c.attributes ?? {} };
  });
}

export const TOOL_NAMES = ['search_products', 'get_product', 'add_to_cart', 'view_cart', 'checkout_with_paypal', 'confirm_payment'] as const;

const toolsSchema = z.object(Object.fromEntries(TOOL_NAMES.map((n) => [n, z.string()])) as Record<(typeof TOOL_NAMES)[number], z.ZodString>);

/** Store-specific WebMCP tool descriptions (helps agents pick the right tool). */
export async function writeToolDescriptions(storeName: string, catalog: Product[], opts: Opts = {}): Promise<Record<string, string>> {
  const { object } = await withModelFallback(
    (model) =>
      generateObject({
        model,
        maxRetries: 0,
        schema: toolsSchema,
        prompt: `Write one-sentence descriptions (max 30 words each) of these WebMCP tools for the store "${storeName}", which sells: ${catalog.map((p) => p.title).join('; ')}.
Tools: search_products(query), get_product(sku), add_to_cart(sku, qty), view_cart(), checkout_with_paypal() — returns a PayPal approval link a human must approve, confirm_payment(orderId, nonce) — completes the purchase after approval.
Mention that payment is through PayPal and needs human approval where relevant.`,
      }),
    { models: opts.models },
  );
  return object;
}


/** Plain-English findings for the merchant; falls back to the failed checks if the AI is unavailable. */
export async function writeFindings(url: string, checks: CheckResult[], opts: Opts = {}): Promise<string[]> {
  const failed = checks.filter((c) => c.status !== 'pass' && c.id !== 'live_agent');
  if (!failed.length) return ['Your store passes every agent-readiness check. Send an AI agent to confirm it can actually buy.'];
  try {
    const { object } = await withModelFallback(
      (model) =>
        generateObject({
          model,
          maxRetries: 0,
          schema: z.object({ findings: z.array(z.string()).min(1).max(6) }),
          prompt: `You advise a small online store owner (not technical) about why AI shopping agents fail to buy from their store at ${url}.
Write 3-5 short findings (max 25 words each), most costly problem first. Plain English, no jargon like "JSON-LD" or "x402" without a 3-word explanation. Each finding: what's wrong + what it costs them.
Check results: ${JSON.stringify(failed.map(({ title, status, evidence }) => ({ title, status, evidence })))}`,
        }),
      { models: opts.models },
    );
    return object.findings;
  } catch {
    return failed.slice(0, 5).map((c) => `${c.title}: ${c.evidence}.`);
  }
}
