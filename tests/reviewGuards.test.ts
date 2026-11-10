import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests } from '@/lib/db';
import { createRun, getRun } from '@/lib/agents/runLog';
import { runHeadlessAgent } from '@/lib/agents/headless';
import { createPayPalClient } from '@/lib/paypal/client';
import { POST as runPost } from '@/app/api/run/route';
import { fakePaypal } from './helpers/fakePaypal';
import { scriptedModel, toolCallResult, textResult } from './helpers/mockModels';

beforeEach(() => resetDbForTests());

describe('review guards', () => {
  it('/api/run rejects private targets', async () => {
    for (const url of ['http://127.0.0.1:8080/', 'http://169.254.169.254/latest', 'http://10.0.0.2/']) {
      const res = await runPost(new Request('http://x/api/run', { method: 'POST', body: JSON.stringify({ kind: 'headless', url }) }));
      expect(res.status, url).toBe(400);
    }
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
