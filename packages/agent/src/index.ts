/**
 * @lintel-agent/sdk — let any AI agent buy from any Lintel store.
 *
 *   const store = await discover('https://fernwoodtea.com');
 *   const products = await getCatalog(store);
 *   const receipt = await buy(store, [{ sku: 'FW-SEN-50', qty: 1 }], {
 *     onApprovalRequired: ({ approveUrl, amount }) => tellTheUser(`Approve $${amount}: ${approveUrl}`),
 *   });
 *
 * Checkout is x402 (HTTP 402 Payment Required) with the "paypal-order" scheme: the store answers with a
 * PayPal order, a person approves it in PayPal, and the agent retries with proof. Agents never handle
 * card numbers or passwords, and nothing is charged until a person approves. No dependencies.
 */

export interface StoreManifest {
  name: string;
  description?: string;
  catalog: string;
  checkout: { url: string; method: 'POST'; protocol: 'x402'; x402Version: number; schemes: string[] };
  webmcp?: boolean;
}

export interface Product {
  sku: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  attributes: Record<string, string>;
  inStock: boolean;
}

export interface CartItem { sku: string; qty: number }

export interface ApprovalRequest { approveUrl: string; amount: string; currency: string; orderId: string }

export interface Receipt {
  status: 'paid';
  amount: string;
  paypalOrderId: string;
  captureId: string;
  lines?: { sku: string; qty: number; unit: string; total: string }[];
}

export interface Options { fetch?: typeof fetch }

export interface BuyOptions extends Options {
  /** Show the person the PayPal link. Called once; the agent then waits for their approval. */
  onApprovalRequired: (req: ApprovalRequest) => void | Promise<void>;
  /** How long to wait for the person to approve (default 15 minutes, the order's lifetime). */
  timeoutMs?: number;
  /** How often to check for approval (default 3 seconds). */
  pollMs?: number;
  signal?: AbortSignal;
}

export type ErrorCode = 'no_manifest' | 'bad_manifest' | 'unsupported_scheme' | 'approval_timeout' | 'store_error' | 'network';

export class LintelError extends Error {
  constructor(message: string, public code: ErrorCode, public status?: number, public detail?: unknown) {
    super(message);
    this.name = 'LintelError';
  }
}

const SCHEME = 'paypal-order';
const getFetch = (o?: Options) => o?.fetch ?? globalThis.fetch;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(new LintelError('Cancelled.', 'network')); }, { once: true });
  });

function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function get(url: string, f: typeof fetch, accept: string): Promise<Response> {
  try {
    return await f(url, { headers: { accept } });
  } catch (e) {
    throw new LintelError(`Couldn’t reach ${url}.`, 'network', undefined, e);
  }
}

/** Finds a store's agent manifest from its web page (link rel="agent-manifest"), or loads a manifest URL directly. */
export async function discover(storeOrManifestUrl: string, opts: Options = {}): Promise<StoreManifest> {
  const f = getFetch(opts);
  let res = await get(storeOrManifestUrl, f, 'application/json, text/html');
  let manifestUrl = storeOrManifestUrl;
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) {
    const html = await res.text();
    const tag = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => /rel=["']?agent-manifest["']?/i.test(t));
    const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) throw new LintelError('This store doesn’t publish a Lintel agent manifest.', 'no_manifest');
    manifestUrl = new URL(href, storeOrManifestUrl).toString();
    res = await get(manifestUrl, f, 'application/json');
  }
  if (!res.ok) throw new LintelError(`The store’s agent manifest returned ${res.status}.`, 'bad_manifest', res.status);
  const m = (await res.json().catch(() => null)) as StoreManifest | null;
  if (!m?.catalog || !m.checkout?.url) throw new LintelError('The store’s agent manifest is incomplete.', 'bad_manifest');
  return {
    ...m,
    catalog: new URL(m.catalog, manifestUrl).toString(),
    checkout: { ...m.checkout, url: new URL(m.checkout.url, manifestUrl).toString() },
  };
}

export async function getCatalog(store: StoreManifest, opts: Options = {}): Promise<Product[]> {
  const res = await get(store.catalog, getFetch(opts), 'application/json');
  if (!res.ok) throw new LintelError(`The catalog returned ${res.status}.`, 'store_error', res.status);
  const body = (await res.json()) as { products?: Product[] };
  return body.products ?? [];
}

type Accepts = { scheme: string; network: string; amount: string; asset: string; extra: { orderId: string; approveUrl: string; nonce: string } };

async function post(store: StoreManifest, items: CartItem[], f: typeof fetch, proof?: string): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (proof) headers['PAYMENT-SIGNATURE'] = proof;
  try {
    return await f(store.checkout.url, { method: 'POST', headers, body: JSON.stringify({ items }) });
  } catch (e) {
    throw new LintelError('Couldn’t reach the store’s checkout.', 'network', undefined, e);
  }
}

async function storeError(res: Response): Promise<LintelError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new LintelError(body.error ? `Checkout failed: ${body.error}` : `Checkout failed (${res.status}).`, 'store_error', res.status, body);
}

/**
 * Buys a cart. The person approves the exact amount in PayPal; the agent then pays with proof.
 * Resolves with the PayPal receipt, or rejects with a LintelError (approval_timeout if no one approved).
 */
export async function buy(store: StoreManifest, items: CartItem[], opts: BuyOptions): Promise<Receipt> {
  if (!store.checkout.schemes?.includes(SCHEME)) throw new LintelError(`This store doesn’t accept ${SCHEME} payments.`, 'unsupported_scheme');
  const f = getFetch(opts);
  const first = await post(store, items, f);
  if (first.ok) return (await first.json()) as Receipt; // free or already paid
  if (first.status !== 402) throw await storeError(first);
  const required = (await first.json()) as { accepts?: Accepts[] };
  const offer = required.accepts?.find((a) => a.scheme === SCHEME);
  if (!offer) throw new LintelError(`This store doesn’t accept ${SCHEME} payments.`, 'unsupported_scheme');

  await opts.onApprovalRequired({ approveUrl: offer.extra.approveUrl, amount: offer.amount, currency: offer.asset, orderId: offer.extra.orderId });

  const proof = b64encode(JSON.stringify({ x402Version: 2, scheme: SCHEME, network: offer.network, payload: { orderId: offer.extra.orderId, nonce: offer.extra.nonce } }));
  const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60_000);
  const pollMs = opts.pollMs ?? 3000;
  while (Date.now() < deadline) {
    const res = await post(store, items, f, proof);
    if (res.ok) return (await res.json()) as Receipt;
    if (res.status !== 402) throw await storeError(res);
    await sleep(pollMs, opts.signal);
  }
  throw new LintelError('The payment wasn’t approved in time.', 'approval_timeout');
}
