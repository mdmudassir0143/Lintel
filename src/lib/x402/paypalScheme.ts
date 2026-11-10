/**
 * x402 v2 payment scheme "paypal-order": settles x402 payments through PayPal Orders v2.
 *
 * Flow: server answers 402 with a PayPal order to approve -> buyer approves in PayPal ->
 * client retries with PAYMENT-SIGNATURE {orderId, nonce} -> server verifies and captures.
 */
import crypto from 'node:crypto';
import { getDb } from '../db';
import { env } from '../env';
import type { PayPalApi } from '../paypal/client';

export const SCHEME = 'paypal-order' as const;
export const NETWORK = 'paypal:sandbox' as const;

export interface CartItem {
  sku: string;
  qty: number;
}

export interface PaymentRequirement {
  scheme: typeof SCHEME;
  network: typeof NETWORK;
  amount: string;
  asset: 'USD';
  payTo: string;
  maxTimeoutSeconds: 900;
  resource: string;
  description: string;
  extra: { orderId: string; approveUrl: string; nonce: string };
}

export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  accepts: PaymentRequirement[];
}

export interface PaymentPayload {
  x402Version: 2;
  scheme: typeof SCHEME;
  network: typeof NETWORK;
  payload: { orderId: string; nonce: string };
}

export interface SettlementReceipt {
  success: true;
  network: typeof NETWORK;
  transaction: string;
  paypalOrderId: string;
  amount: string;
  payer?: string;
}

export type SettleError =
  | 'invalid_payload'
  | 'unknown_nonce'
  | 'cart_mismatch'
  | 'order_mismatch'
  | 'payment_not_approved'
  | 'amount_mismatch'
  | 'capture_failed';

export type SettleResult =
  | { ok: true; receipt: SettlementReceipt; firstSettlement: boolean }
  | { ok: false; httpStatus: 400 | 402; error: SettleError };

export function encodeHeader(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

export function decodeHeader<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as T;
}

export function cartHash(items: CartItem[]): string {
  const sorted = [...items]
    .map((i) => ({ sku: i.sku, qty: i.qty }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

export async function createPaymentRequired(args: {
  paypal: PayPalApi;
  merchantId: string;
  amount: string;
  items: CartItem[];
  resource: string;
  description: string;
}): Promise<PaymentRequired> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const order = await args.paypal.createOrder({
    amount: args.amount,
    customId: nonce,
    description: args.description,
    returnUrl: `${env.publicBaseUrl}/api/paypal/return`,
    cancelUrl: `${env.publicBaseUrl}/api/paypal/return?cancel=1`,
  });
  const required: PaymentRequired = {
    x402Version: 2,
    accepts: [
      {
        scheme: SCHEME,
        network: NETWORK,
        amount: args.amount,
        asset: 'USD',
        payTo: args.merchantId,
        maxTimeoutSeconds: 900,
        resource: args.resource,
        description: args.description,
        extra: { orderId: order.id, approveUrl: order.approveUrl ?? '', nonce },
      },
    ],
  };
  getDb()
    .prepare(
      `insert into payment_nonces (nonce, merchant_id, paypal_order_id, amount, cart_hash, requirement, status, created_at)
       values (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(nonce, args.merchantId, order.id, args.amount, cartHash(args.items), JSON.stringify(required), Date.now());
  return required;
}

/** The PaymentRequired originally issued for a nonce (so retries keep the same order). */
export function storedRequirement(nonce: string): PaymentRequired | null {
  const row = getDb().prepare('select requirement from payment_nonces where nonce = ?').get(nonce) as
    | { requirement: string }
    | undefined;
  return row ? (JSON.parse(row.requirement) as PaymentRequired) : null;
}

function parsePayload(header: string): PaymentPayload | null {
  try {
    const p = decodeHeader<PaymentPayload>(header);
    if (
      p?.x402Version !== 2 ||
      p.scheme !== SCHEME ||
      p.network !== NETWORK ||
      typeof p.payload?.orderId !== 'string' ||
      typeof p.payload?.nonce !== 'string'
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

interface NonceRow {
  nonce: string;
  paypal_order_id: string;
  amount: string;
  cart_hash: string;
  status: 'pending' | 'settled';
  receipt: string | null;
}

export async function verifyAndSettle(args: {
  paypal: PayPalApi;
  merchantId: string;
  items: CartItem[];
  amount: string;
  header: string;
  runId?: string;
}): Promise<SettleResult> {
  const fail = (httpStatus: 400 | 402, error: SettleError): SettleResult => ({ ok: false, httpStatus, error });
  const p = parsePayload(args.header);
  if (!p) return fail(400, 'invalid_payload');

  const db = getDb();
  const row = db
    .prepare('select * from payment_nonces where nonce = ? and merchant_id = ?')
    .get(p.payload.nonce, args.merchantId) as NonceRow | undefined;
  if (!row) return fail(400, 'unknown_nonce');
  if (row.cart_hash !== cartHash(args.items)) return fail(400, 'cart_mismatch');
  if (row.paypal_order_id !== p.payload.orderId) return fail(400, 'order_mismatch');
  if (row.status === 'settled' && row.receipt) {
    return { ok: true, receipt: JSON.parse(row.receipt), firstSettlement: false };
  }

  let order;
  try {
    order = await args.paypal.getOrder(row.paypal_order_id);
  } catch {
    return fail(402, 'payment_not_approved');
  }
  if (order.status !== 'APPROVED' && order.status !== 'COMPLETED') return fail(402, 'payment_not_approved');
  if (order.amount !== row.amount || row.amount !== args.amount || order.customId !== row.nonce) {
    return fail(400, 'amount_mismatch');
  }

  let captured;
  try {
    captured = await args.paypal.captureOrder(row.paypal_order_id);
  } catch {
    return fail(402, 'capture_failed');
  }
  if (captured.status !== 'COMPLETED' || !captured.captureId) return fail(402, 'capture_failed');

  const receipt: SettlementReceipt = {
    success: true,
    network: NETWORK,
    transaction: captured.captureId,
    paypalOrderId: row.paypal_order_id,
    amount: row.amount,
    payer: captured.payerEmail ?? order.payerEmail,
  };
  // Only one concurrent settlement may win; the loser returns the stored receipt.
  const settle = db.transaction((): boolean => {
    const won = db
      .prepare(`update payment_nonces set status = 'settled', receipt = ? where nonce = ? and status = 'pending'`)
      .run(JSON.stringify(receipt), row.nonce).changes === 1;
    if (!won) return false;
    db.prepare(
      `insert into orders (id, merchant_id, paypal_order_id, capture_id, amount, items, payer_email, run_id, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      args.merchantId,
      row.paypal_order_id,
      receipt.transaction,
      row.amount,
      JSON.stringify(args.items),
      receipt.payer ?? null,
      args.runId ?? null,
      Date.now(),
    );
    return true;
  });
  if (!settle()) {
    const stored = db.prepare('select receipt from payment_nonces where nonce = ?').get(row.nonce) as { receipt: string };
    return { ok: true, receipt: JSON.parse(stored.receipt), firstSettlement: false };
  }
  return { ok: true, receipt, firstSettlement: true };
}
