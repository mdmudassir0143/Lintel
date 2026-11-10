import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { resetDbForTests } from '@/lib/db';
import { createRun, getRun } from '@/lib/agents/runLog';
import { runBrowserAgent } from '@/lib/agents/browser';
import { fakePaypal } from './helpers/fakePaypal';
import { scriptedModel, toolCallResult, textResult } from './helpers/mockModels';

const root = path.join(__dirname, '..');
let base = '';
let server: http.Server;
const catalog = [{ sku: 'RC-ETH12', title: 'Ethiopia Yirgacheffe — Natural Process, 12 oz', description: 'Berry, floral', price: '22.00', currency: 'USD', attributes: { origin: 'Ethiopia' }, inStock: true }];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const send = (type: string, body: string, status = 200) => { res.writeHead(status, { 'content-type': type }); res.end(body); };
    if (req.url === '/lintel.js') return send('application/javascript', fs.readFileSync(path.join(root, 'public/lintel.js'), 'utf8'));
    if (req.url === '/m/ridgeline/agent/config') return send('application/json', JSON.stringify({ tools: [] }));
    if (req.url === '/m/ridgeline/agent/catalog') return send('application/json', JSON.stringify({ products: catalog }));
    if (req.url === '/before') return send('text/html', fs.readFileSync(path.join(__dirname, 'fixtures/before.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/gi, ''));
    send('text/html', `<!doctype html><html><head><title>Ridgeline (after)</title><script src="/lintel.js" data-merchant="ridgeline" data-base="${base}"></script></head><body><h1>Fresh coffee</h1><p>Ethiopia $22.00</p></body></html>`);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.closeAllConnections?.(); server.close(); });
beforeEach(() => resetDbForTests());

describe('browser agent (local chromium)', () => {
  it('discovers and calls site tools', async () => {
    const runId = createRun({ kind: 'browser', goal: 'buy' });
    const model = scriptedModel([
      toolCallResult('list_site_tools', {}),
      toolCallResult('call_site_tool', { name: 'search_products', args: { query: 'ethiopia' } }),
      toolCallResult('finish', { success: false, summary: 'found it' }),
      textResult('ok'),
    ]);
    const outcome = await runBrowserAgent({ runId, url: `${base}/after`, goal: 'buy', deps: { paypal: fakePaypal().api, model, approvalTimeoutMs: 50 } });
    expect(outcome).toBe('found_product');
    const { steps, run } = getRun(runId)!;
    const list = steps.find((s) => s.action === 'list_site_tools')!;
    expect(JSON.stringify(list.detail)).toContain('checkout_with_paypal');
    const call = steps.find((s) => s.action === 'call_site_tool')!;
    expect(JSON.stringify(call.detail)).toContain('RC-ETH12');
    expect(call.screenshot).toMatch(/^data:image\/jpeg;base64,/);
    expect(steps[0].action).toBe('goto');
    expect(run.status).toBe('failed');
  }, 60000);

  it('reports blocker on before fixture', async () => {
    const runId = createRun({ kind: 'browser', goal: 'buy' });
    const model = scriptedModel([
      toolCallResult('read_page', {}),
      toolCallResult('list_site_tools', {}),
      toolCallResult('finish', { success: false, summary: 'Blocked by cookie wall' }),
      textResult('blocked'),
    ]);
    const outcome = await runBrowserAgent({ runId, url: `${base}/before`, goal: 'buy', deps: { paypal: fakePaypal().api, model, approvalTimeoutMs: 50 } });
    expect(outcome).toBe('failed');
    const { steps, run } = getRun(runId)!;
    expect(JSON.stringify(steps.find((s) => s.action === 'read_page')!.detail)).toContain('We value your privacy');
    expect(JSON.stringify(steps.find((s) => s.action === 'list_site_tools')!.detail)).toMatch(/none/i);
    expect(run.summary).toContain('cookie wall');
  }, 60000);
});
