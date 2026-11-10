import type { PayPalApi } from '../paypal/client';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls PayPal until the buyer approves the order, or the timeout passes. */
export async function waitForApproval(paypal: PayPalApi, orderId: string, opts: { timeoutMs: number; pollMs?: number }): Promise<'approved' | 'timeout'> {
  const poll = opts.pollMs ?? 3000;
  const deadline = Date.now() + opts.timeoutMs;
  while (true) {
    try {
      const o = await paypal.getOrder(orderId);
      if (o.status === 'APPROVED' || o.status === 'COMPLETED') return 'approved';
    } catch {
      // transient PayPal error: keep polling until the deadline
    }
    if (Date.now() + poll > deadline) return 'timeout';
    await sleep(poll);
  }
}
