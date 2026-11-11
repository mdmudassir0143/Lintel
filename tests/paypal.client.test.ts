import { describe, it, expect } from 'vitest';
import { createPayPalClient, PayPalError } from '@/lib/paypal/client';

type Call = { url: string; init?: RequestInit };

function stubFetch(routes: (c: Call) => { status?: number; body: unknown } | undefined) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    const c = { url: String(url), init };
    calls.push(c);
    const r = routes(c) ?? { status: 404, body: { name: 'NOT_FOUND' } };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const token = { body: { access_token: 'T', expires_in: 32400 } };
const order = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'O1',
  status,
  purchase_units: [{ amount: { value: '22.00', currency_code: 'USD' }, custom_id: 'nonce1', ...extra }],
  links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=O1' }],
});

describe('PayPal client', () => {
  it('caches oauth token', async () => {
    const { impl, calls } = stubFetch((c) =>
      c.url.endsWith('/v1/oauth2/token') ? token : { body: order('CREATED') },
    );
    const pp = createPayPalClient({ clientId: 'id', clientSecret: 's', fetchImpl: impl });
    await pp.getOrder('O1');
    await pp.getOrder('O1');
    expect(calls.filter((c) => c.url.endsWith('/v1/oauth2/token'))).toHaveLength(1);
    expect(calls.every((c) => c.url.startsWith('https://api-m.sandbox.paypal.com/'))).toBe(true);
  });

  it('createOrder maps approve link and custom id', async () => {
    const { impl, calls } = stubFetch((c) =>
      c.url.endsWith('/v1/oauth2/token') ? token : { status: 200, body: order('PAYER_ACTION_REQUIRED') },
    );
    const pp = createPayPalClient({ clientId: 'id', clientSecret: 's', fetchImpl: impl });
    const o = await pp.createOrder({ amount: '22.00', customId: 'nonce1', description: 'x', returnUrl: 'https://r', cancelUrl: 'https://c' });
    expect(o.approveUrl).toBe('https://www.sandbox.paypal.com/checkoutnow?token=O1');
    expect(o.customId).toBe('nonce1');
    expect(o.amount).toBe('22.00');
    const sent = JSON.parse(String(calls.at(-1)!.init!.body));
    expect(sent.intent).toBe('CAPTURE');
    expect(sent.payment_source.paypal.experience_context.return_url).toBe('https://r');
  });

  it('captureOrder already captured returns order', async () => {
    const { impl } = stubFetch((c) => {
      if (c.url.endsWith('/v1/oauth2/token')) return token;
      if (c.url.endsWith('/capture')) return { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] } };
      return { body: order('COMPLETED', { payments: { captures: [{ id: 'CAP1' }] } }) };
    });
    const pp = createPayPalClient({ clientId: 'id', clientSecret: 's', fetchImpl: impl });
    const o = await pp.captureOrder('O1');
    expect(o.status).toBe('COMPLETED');
    expect(o.captureId).toBe('CAP1');
  });

  it('throws PayPalError with issue on other failures', async () => {
    const { impl } = stubFetch((c) =>
      c.url.endsWith('/v1/oauth2/token') ? token : { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_NOT_APPROVED' }] } },
    );
    const pp = createPayPalClient({ clientId: 'id', clientSecret: 's', fetchImpl: impl });
    await expect(pp.captureOrder('O1')).rejects.toMatchObject({ status: 422, issue: 'ORDER_NOT_APPROVED' });
    await expect(pp.captureOrder('O1')).rejects.toBeInstanceOf(PayPalError);
  });

  it.skipIf(!process.env.PAYPAL_CLIENT_ID)('sandbox create order (live)', async () => {
    const pp = createPayPalClient();
    const o = await pp.createOrder({ amount: '1.00', customId: 'lintel-live-test', description: 'Lintel live test', returnUrl: 'https://example.com/r', cancelUrl: 'https://example.com/c' });
    expect(['PAYER_ACTION_REQUIRED', 'CREATED']).toContain(o.status);
    expect(o.approveUrl).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\//);
  });
});

describe('PayPal client payee', () => {
  it('sends the merchant as payee when given', async () => {
    const { impl, calls } = stubFetch((c) => (c.url.endsWith('/v1/oauth2/token') ? token : { body: order('PAYER_ACTION_REQUIRED') }));
    const pp = createPayPalClient({ clientId: 'id', clientSecret: 's', fetchImpl: impl });
    await pp.createOrder({ amount: '1.00', customId: 'n', description: 'x', returnUrl: 'https://r', cancelUrl: 'https://c', payeeEmail: 'pay@shop.test' });
    expect(JSON.parse(String(calls.at(-1)!.init!.body)).purchase_units[0].payee).toEqual({ email_address: 'pay@shop.test' });
    await pp.createOrder({ amount: '1.00', customId: 'n2', description: 'x', returnUrl: 'https://r', cancelUrl: 'https://c' });
    expect(JSON.parse(String(calls.at(-1)!.init!.body)).purchase_units[0].payee).toBeUndefined();
  });
});
