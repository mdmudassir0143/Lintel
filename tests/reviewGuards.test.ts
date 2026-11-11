import { describe, it, expect, beforeEach, vi } from 'vitest';

let sessionToken: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (sessionToken ? { value: sessionToken } : undefined), set: () => {}, delete: () => {} }),
}));
import { resetDbForTests } from '@/lib/db';
import { createRun, getRun } from '@/lib/agents/runLog';
import { runHeadlessAgent } from '@/lib/agents/headless';
import { createPayPalClient } from '@/lib/paypal/client';
import { POST as runPost } from '@/app/api/run/route';
import { POST as storesPost } from '@/app/api/stores/route';
import { createUser, createSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { fakePaypal } from './helpers/fakePaypal';
import { scriptedModel, toolCallResult, textResult } from './helpers/mockModels';

beforeEach(() => { resetDbForTests(); sessionToken = undefined; });

describe('review guards', () => {
  it('/api/run requires a signed-in user and one of their stores', async () => {
    const post = (body: unknown) => runPost(new Request('http://x/api/run', { method: 'POST', body: JSON.stringify(body) }));
    expect((await post({ kind: 'headless', merchantId: 'ridgeline' })).status).toBe(401);
    const alice = await createUser({ email: 'alice@shop.test', name: 'A', password: 'longenough1' });
    const bob = await createUser({ email: 'bob@shop.test', name: 'B', password: 'longenough1' });
    getDb().prepare(`insert into merchants (id, name, store_url, owner_id, created_at) values ('bobs', 'Bob', 'https://bob.test', ?, 1)`).run(bob.id);
    sessionToken = createSession(alice.id);
    expect((await post({ kind: 'headless', url: 'http://169.254.169.254/latest' })).status).toBe(400);
    expect((await post({ kind: 'headless', merchantId: 'bobs' })).status).toBe(404);
  });

  it('a store cannot be added with a private address', async () => {
    const alice = await createUser({ email: 'alice@shop.test', name: 'A', password: 'longenough1' });
    sessionToken = createSession(alice.id);
    for (const url of ['http://127.0.0.1:8080/', '169.254.169.254', 'http://10.0.0.2/', 'localhost:5432']) {
      const res = await storesPost(new Request('http://x/api/stores', { method: 'POST', body: JSON.stringify({ name: 'S', url }) }));
      expect(res.status, url).toBe(400);
    }
    expect(getDb().prepare('select count(*) n from merchants where owner_id = ?').get(alice.id)).toEqual({ n: 0 });
  });

  it('/api/run refuses a stored store address that points at a private network', async () => {
    const alice = await createUser({ email: 'alice@shop.test', name: 'A', password: 'longenough1' });
    getDb().prepare(`insert into merchants (id, name, store_url, owner_id, installed, created_at) values ('evil', 'E', 'http://10.0.0.2', ?, 1, 1)`).run(alice.id);
    sessionToken = createSession(alice.id);
    const res = await runPost(new Request('http://x/api/run', { method: 'POST', body: JSON.stringify({ kind: 'headless', merchantId: 'evil' }) }));
    expect(res.status).toBe(400);
  });

  it('headless agent cannot fetch private addresses by default', async () => {
    const runId = createRun({ kind: 'headless', goal: 'x' });
    const model = scriptedModel([
      toolCallResult('http_get', { url: 'http://169.254.169.254/latest/meta-data' }),
      toolCallResult('finish', { success: false, summary: 'blocked' }),
      textResult('x'),
    ]);
    await runHeadlessAgent({ runId, url: 'https://example.com', goal: 'x', deps: { paypal: fakePaypal().api, model, approvalTimeoutMs: 10 } });
    const step = getRun(runId)!.steps.find((s) => s.action === 'http_get')!;
    expect(JSON.stringify(step.detail)).toMatch(/not publicly reachable/i);
  });

  it('PayPal calls carry a timeout signal', async () => {
    const signals: unknown[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      const body = String(url).endsWith('/token') ? { access_token: 'T', expires_in: 3600 } : { id: 'O', status: 'CREATED', purchase_units: [{ amount: { value: '1.00', currency_code: 'USD' } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    await createPayPalClient({ clientId: 'a', clientSecret: 'b', fetchImpl: impl }).getOrder('O');
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
  });
});
