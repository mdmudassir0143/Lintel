import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import { resilientModel } from '../llm';
import type { Product } from '../catalog';
import type { CheckResult } from './checks';

type Opts = { models?: LanguageModel[] };
const modelFor = (o: Opts) => (o.models ? resilientModel({ models: o.models, minIntervalMs: 0, maxWaitMs: 2000 }) : resilientModel());

// Schemas avoid z.record (JSON Schema `propertyNames`): Groq's strict structured output rejects it.
export const CLEAN_SCHEMA = z.object({
  products: z.array(
    z.object({
      sku: z.string(),
      title: z.string(),
      description: z.string(),
      attributes: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
  ),
});

/**
 * AI rewrites titles/descriptions/attributes so agents can match products to requests.
 * SKU, price, currency and stock always come from the merchant's data, never the model.
 */
export async function cleanCatalog(raw: Product[], opts: Opts = {}): Promise<Product[]> {
  const { object } = await generateObject({
        model: modelFor(opts),
        maxRetries: 0,
        schema: CLEAN_SCHEMA,
        prompt: `You clean up product catalogs for a small online store so AI shopping agents can understand them.
For each product: write a clear customer-facing title (expand abbreviations, e.g. "ETH YIRG 12OZ - NAT" -> "Ethiopia Yirgacheffe — Natural Process, 12 oz"),
a 1-2 sentence description, and attributes (for coffee: origin, process, roast, size, form, flavor_notes; for equipment: type, includes).
Never invent facts not implied by the data. Keep every sku exactly as given. Do not output prices.
Products:
${JSON.stringify(raw.map(({ sku, title, description }) => ({ sku, title, description })))}`,
      });
  const bySku = new Map(object.products.map((p) => [p.sku, p]));
  return raw.map((p) => {
    const c = bySku.get(p.sku);
    if (!c) return p;
    const attributes = Object.fromEntries((c.attributes ?? []).filter((a) => a.name && a.value).map((a) => [a.name, a.value]));
    return { ...p, title: c.title || p.title, description: c.description || p.description, attributes };
  });
}

export const TOOL_NAMES = ['search_products', 'get_product', 'add_to_cart', 'view_cart', 'checkout_with_paypal', 'confirm_payment'] as const;

export const TOOLS_SCHEMA = z.object(Object.fromEntries(TOOL_NAMES.map((n) => [n, z.string()])) as Record<(typeof TOOL_NAMES)[number], z.ZodString>);

/** Store-specific WebMCP tool descriptions (helps agents pick the right tool). */
export async function writeToolDescriptions(storeName: string, catalog: Product[], opts: Opts = {}): Promise<Record<string, string>> {
  const { object } = await generateObject({
        model: modelFor(opts),
        maxRetries: 0,
        schema: TOOLS_SCHEMA,
        prompt: `Write one-sentence descriptions (max 30 words each) of these WebMCP tools for the store "${storeName}", which sells: ${catalog.map((p) => p.title).join('; ')}.
Tools: search_products(query), get_product(sku), add_to_cart(sku, qty), view_cart(), checkout_with_paypal() — returns a PayPal approval link a human must approve, confirm_payment(orderId, nonce) — completes the purchase after approval.
Mention that payment is through PayPal and needs human approval where relevant.`,
      });
  return object;
}

export const FINDINGS_SCHEMA = z.object({ findings: z.array(z.string()) });

/** Plain-English findings for the merchant; falls back to the failed checks if the AI is unavailable. */
export async function writeFindings(url: string, checks: CheckResult[], opts: Opts = {}): Promise<string[]> {
  const failed = checks.filter((c) => c.status !== 'pass' && c.id !== 'live_agent');
  if (!failed.length) return ['Your store passes every agent-readiness check. Send an AI agent to confirm it can actually buy.'];
  try {
    const { object } = await generateObject({
        model: modelFor(opts),
          maxRetries: 0,
          schema: FINDINGS_SCHEMA,
          prompt: `You advise a small online store owner (not technical) about why AI shopping agents fail to buy from their store at ${url}.
Write 3-5 short findings (max 25 words each), most costly problem first. Plain English, no jargon like "JSON-LD" or "x402" without a 3-word explanation. Each finding: what's wrong + what it costs them.
Check results: ${JSON.stringify(failed.map(({ title, status, evidence }) => ({ title, status, evidence })))}`,
        });
    return object.findings.slice(0, 6);
  } catch {
    return failed.slice(0, 5).map((c) => `${c.title}: ${c.evidence}.`);
  }
}
