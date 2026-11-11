import { env } from '../env';

const BASE = 'https://api-m.sandbox.paypal.com';

export type PayPalOrderStatus =
  | 'CREATED'
  | 'SAVED'
  | 'APPROVED'
  | 'VOIDED'
  | 'COMPLETED'
  | 'PAYER_ACTION_REQUIRED';

export interface PayPalOrder {
  id: string;
  status: PayPalOrderStatus;
  amount: string;
  currency: string;
  customId?: string;
  approveUrl?: string;
  payerEmail?: string;
  captureId?: string;
}

export interface CreateOrderInput {
  amount: string;
  customId: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  /** Merchant's PayPal account; the payment goes straight to it. */
  payeeEmail?: string;
}

export interface PayPalApi {
  createOrder(input: CreateOrderInput): Promise<PayPalOrder>;
  getOrder(id: string): Promise<PayPalOrder>;
  /** Captures an approved order. An already-captured order is returned as-is. */
  captureOrder(id: string): Promise<PayPalOrder>;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public issue?: string,
  ) {
    super(message);
    this.name = 'PayPalError';
  }
}

function mapOrder(d: any): PayPalOrder {
  const pu = d.purchase_units?.[0] ?? {};
  const link = (d.links ?? []).find((l: any) => l.rel === 'payer-action' || l.rel === 'approve');
  return {
    id: d.id,
    status: d.status,
    amount: pu.amount?.value ?? '',
    currency: pu.amount?.currency_code ?? '',
    customId: pu.custom_id ?? pu.payments?.captures?.[0]?.custom_id,
    approveUrl: link?.href,
    payerEmail: d.payer?.email_address,
    captureId: pu.payments?.captures?.[0]?.id,
  };
}

export function createPayPalClient(opts: {
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
} = {}): PayPalApi {
  const doFetch = opts.fetchImpl ?? fetch;
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && Date.now() < token.expiresAt) return token.value;
    const id = opts.clientId ?? env.paypalClientId;
    const secret = opts.clientSecret ?? env.paypalClientSecret;
    const res = await doFetch(`${BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      throw new PayPalError(`PayPal auth failed (${res.status})`, res.status, body.error);
    }
    token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
    return token.value;
  }

  async function call(path: string, init: { method: string; body?: unknown; requestId?: string }) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    };
    if (init.requestId) headers['PayPal-Request-Id'] = init.requestId;
    const res = await doFetch(`${BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const issue = body.details?.[0]?.issue ?? body.name;
      throw new PayPalError(`PayPal ${init.method} ${path} failed: ${issue ?? res.status}`, res.status, issue);
    }
    return body;
  }

  const api: PayPalApi = {
    async createOrder(input) {
      const body = await call('/v2/checkout/orders', {
        method: 'POST',
        requestId: `lintel-${input.customId}`,
        body: {
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: { currency_code: 'USD', value: input.amount },
              custom_id: input.customId,
              description: input.description.slice(0, 127),
              ...(input.payeeEmail ? { payee: { email_address: input.payeeEmail } } : {}),
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                return_url: input.returnUrl,
                cancel_url: input.cancelUrl,
                user_action: 'PAY_NOW',
                shipping_preference: 'NO_SHIPPING',
              },
            },
          },
        },
      });
      return mapOrder(body);
    },
    async getOrder(id) {
      return mapOrder(await call(`/v2/checkout/orders/${encodeURIComponent(id)}`, { method: 'GET' }));
    },
    async captureOrder(id) {
      try {
        return mapOrder(
          await call(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: 'POST', body: {} }),
        );
      } catch (e) {
        if (e instanceof PayPalError && e.issue === 'ORDER_ALREADY_CAPTURED') return api.getOrder(id);
        throw e;
      }
    },
  };
  return api;
}
