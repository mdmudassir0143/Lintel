import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, resetDbForTests } from '@/lib/db';
import { createRun, getRun } from '@/lib/agents/runLog';
import { waitForApproval } from '@/lib/agents/approval';
import { runHeadlessAgent, DEFAULT_GOAL } from '@/lib/agents/headless';
import { handleCheckout, handleManifest, handleCatalog } from '@/lib/agentEndpoints';
import { fakePaypal } from './helpers/fakePaypal';
import { scriptedModel, toolCallResult, textResult } from './helpers/mockModels';
import type { PayPalApi } from '@/lib/paypal/client';

const BASE = 'http://localhost:3000';
const STORE = `${BASE}/store/ridgeline`;
const fx = (n: string) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

function storeFetch(mode: 'before' | 'after', paypal: PayPalApi): typeof fetch {
  return (async (input: any, init?: RequestInit) => {
    const url = String(input);
    const html = (b: string) => new Response(b, { headers: { 'content-type': 'text/html' } });
    if (url === STORE || url === `${STORE}/`) return html(fx(`${mode}.html`));
    if (url.endsWith('/m/ridgeline/agent/manifest.json')) return handleManifest('ridgeline', BASE);
    if (url.endsWith('/m/ridgeline/agent/catalog')) return handleCatalog('ridgeline');
    if (url.endsWith('/m/ridgeline/agent/checkout')) return handleCheckout(new Request(url, init), 'ridgeline', { paypal });
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

const happyScript = [
  toolCallResult('find_agent_manifest', { storeUrl: STORE }),
  toolCallResult('http_get', { url: `${BASE}/m/ridgeline/agent/catalog` }),
  toolCallResult('post_checkout', { items: [{ sku: 'RC-ETH12', qty: 1 }] }),
  toolCallResult('request_payment_approval', {}),
  toolCallResult('pay_with_proof', {}),
  toolCallResult('finish', { success: true, summary: 'Bought Ethiopia Yirgacheffe for $22.00' }),
  textResult('Done.'),
];

describe('headless agent', () => {
  beforeEach(() => {
    resetDbForTests();
    getDb().prepare("update merchants set installed = 1 where id = 'ridgeline'").run();
  });

  it('completes purchase when approved', async () => {
    const pp = fakePaypal({ autoApproveAfterGets: 1 });
    const runId = createRun({ kind: 'headless', goal: DEFAULT_GOAL.replace('{url}', STORE), merchantId: 'ridgeline' });
    const outcome = await runHeadlessAgent({
      runId, url: STORE, goal: 'buy', deps: { paypal: pp.api, fetchImpl: storeFetch('after', pp.api), model: scriptedModel(happyScript), approvalTimeoutMs: 1000, pollMs: 5 },
    });
    expect(outcome).toBe('completed');
    const { run, steps } = getRun(runId)!;
    expect(run.status).toBe('succeeded');
    expect(run.summary).toContain('$22.00');
    expect(steps.some((s) => s.action === 'approval_requested')).toBe(true);
    const order = getDb().prepare('select run_id, amount from orders').get();
    expect(order).toEqual({ run_id: runId, amount: '22.00' });
  });

  it('stops when approval times out', async () => {
    const pp = fakePaypal();
    const runId = createRun({ kind: 'headless', goal: 'buy' });
    const script = [...happyScript.slice(0, 4), toolCallResult('finish', { success: false, summary: 'Payment was not approved' }), textResult('Stopped.')];
    const outcome = await runHeadlessAgent({
      runId, url: STORE, goal: 'buy', deps: { paypal: pp.api, fetchImpl: storeFetch('after', pp.api), model: scriptedModel(script), approvalTimeoutMs: 50, pollMs: 10 },
    });
    expect(outcome).toBe('reached_payment');
    const { run } = getRun(runId)!;
    expect(run.status).toBe('failed');
    expect(run.summary).toMatch(/approval timed out/i);
    expect(pp.counts.capture).toBe(0);
  });

  it('pay_with_proof is refused before approval was requested', async () => {
    const pp = fakePaypal();
    const runId = createRun({ kind: 'headless', goal: 'buy' });
    const script = [
      toolCallResult('find_agent_manifest', { storeUrl: STORE }),
      toolCallResult('post_checkout', { items: [{ sku: 'RC-ETH12', qty: 1 }] }),
      toolCallResult('pay_with_proof', {}),
      toolCallResult('finish', { success: false, summary: 'x' }),
      textResult('x'),
    ];
    await runHeadlessAgent({ runId, url: STORE, goal: 'buy', deps: { paypal: pp.api, fetchImpl: storeFetch('after', pp.api), model: scriptedModel(script), approvalTimeoutMs: 50, pollMs: 10 } });
    const payStep = getRun(runId)!.steps.find((s) => s.action === 'pay_with_proof')!;
    expect(JSON.stringify(payStep.detail)).toMatch(/request_payment_approval first/i);
    expect(pp.counts.capture).toBe(0);
  });

  it('before-mode store -> failed', async () => {
    getDb().prepare("update merchants set installed = 0 where id = 'ridgeline'").run();
    const pp = fakePaypal();
    const runId = createRun({ kind: 'headless', goal: 'buy' });
    const script = [
      toolCallResult('find_agent_manifest', { storeUrl: STORE }),
      toolCallResult('http_get', { url: STORE }),
      toolCallResult('finish', { success: false, summary: 'No prices or checkout available to agents' }),
      textResult('Could not buy.'),
    ];
    const outcome = await runHeadlessAgent({ runId, url: STORE, goal: 'buy', deps: { paypal: pp.api, fetchImpl: storeFetch('before', pp.api), model: scriptedModel(script), approvalTimeoutMs: 50, pollMs: 10 } });
    expect(outcome).toBe('failed');
    expect(getRun(runId)!.run.status).toBe('failed');
  });

  it('waitForApproval returns approved / timeout', async () => {
    const pp = fakePaypal();
    const o = await pp.api.createOrder({ amount: '1.00', customId: 'n', description: '', returnUrl: '', cancelUrl: '' });
    expect(await waitForApproval(pp.api, o.id, { timeoutMs: 30, pollMs: 5 })).toBe('timeout');
    pp.approve(o.id);
    expect(await waitForApproval(pp.api, o.id, { timeoutMs: 30, pollMs: 5 })).toBe('approved');
  });
});
