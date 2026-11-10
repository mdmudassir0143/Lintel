import type { PayPalApi, PayPalOrder, CreateOrderInput } from '@/lib/paypal/client';
import { PayPalError } from '@/lib/paypal/client';

/** In-memory PayPal double. Orders start PAYER_ACTION_REQUIRED; call approve(id) to simulate the buyer. */
export function fakePaypal(opts: { autoApproveAfterGets?: number } = {}) {
  const orders = new Map<string, PayPalOrder>();
  const gets = new Map<string, number>();
  const counts = { create: 0, get: 0, capture: 0 };
  let n = 0;
  const api: PayPalApi = {
    async createOrder(input: CreateOrderInput) {
      counts.create++;
      const id = `FAKE${++n}`;
      const o: PayPalOrder = {
        id,
        status: 'PAYER_ACTION_REQUIRED',
        amount: input.amount,
        currency: 'USD',
        customId: input.customId,
        approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`,
      };
      orders.set(id, o);
      return { ...o };
    },
    async getOrder(id) {
      counts.get++;
      const o = orders.get(id);
      if (!o) throw new PayPalError('not found', 404, 'RESOURCE_NOT_FOUND');
      const g = (gets.get(id) ?? 0) + 1;
      gets.set(id, g);
      if (opts.autoApproveAfterGets !== undefined && g >= opts.autoApproveAfterGets && o.status === 'PAYER_ACTION_REQUIRED') {
        o.status = 'APPROVED';
        o.payerEmail = 'buyer@personal.example.com';
      }
      return { ...o };
    },
    async captureOrder(id) {
      counts.capture++;
      const o = orders.get(id);
      if (!o) throw new PayPalError('not found', 404, 'RESOURCE_NOT_FOUND');
      if (o.status === 'COMPLETED') return { ...o };
      if (o.status !== 'APPROVED') throw new PayPalError('not approved', 422, 'ORDER_NOT_APPROVED');
      o.status = 'COMPLETED';
      o.captureId = `CAP-${id}`;
      return { ...o };
    },
  };
  return {
    api,
    counts,
    orders,
    approve(id: string) {
      const o = orders.get(id)!;
      o.status = 'APPROVED';
      o.payerEmail = 'buyer@personal.example.com';
    },
  };
}
