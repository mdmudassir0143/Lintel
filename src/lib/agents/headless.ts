import { generateText, tool, stepCountIs, type LanguageModel } from 'ai';
import { z } from 'zod';
import { resilientModel, compactMessages } from '../llm';
import { guardedFetch } from '../net';
import { env } from '../env';
import type { PayPalApi } from '../paypal/client';
import type { LiveOutcome } from '../scan/checks';
import { decodeHeader, encodeHeader, type PaymentRequired } from '../x402/paypalScheme';
import { addStep, setRunStatus } from './runLog';
import { waitForApproval } from './approval';

export const DEFAULT_GOAL = 'Buy one 12 oz bag of Ethiopian coffee for under $25.';
export const HEADLESS_MAX_STEPS = 12;

export interface AgentDeps {
  paypal: PayPalApi;
  fetchImpl?: typeof fetch;
  model?: LanguageModel;
  approvalTimeoutMs: number;
  pollMs?: number;
}

const SYSTEM = `You are an AI shopping agent acting for a human. You shop over HTTP only (no browser).
Rules:
- Start with find_agent_manifest on the store URL. If the store has no agent manifest, you may http_get the store page ONCE to look for prices and a checkout usable over HTTP.
- Never guess URLs. Only fetch URLs given by the user, the manifest, or links in pages you fetched.
- Only buy what the goal asks for, within its budget. Never invent SKUs: use SKUs from the catalog.
- To pay: post_checkout, then request_payment_approval (the human approves in PayPal), then pay_with_proof.
- If something blocks you (no prices, no checkout, approval not given), stop.
- Always end by calling finish with success and a one-sentence summary for the human.`;

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…[truncated]` : s;
}

export async function runHeadlessAgent(args: { runId: string; url: string; goal: string; deps: AgentDeps }): Promise<LiveOutcome> {
  const { runId, deps } = args;
  // Default: public addresses only (plus Lintel itself), 10s timeout, 2MB cap per response.
  const ownHost = new URL(env.publicBaseUrl).host;
  const doFetch: typeof fetch =
    deps.fetchImpl ?? (((u: string | URL | Request, init?: RequestInit) => guardedFetch(String(u), init, { allowHosts: [ownHost] })) as typeof fetch);
  const state = {
    manifest: null as any,
    foundProduct: false,
    pending: null as null | { url: string; items: { sku: string; qty: number }[]; orderId: string; nonce: string; amount: string; approveUrl: string },
    approved: false,
    approvalTimedOut: false,
    paid: null as any,
    finish: null as null | { success: boolean; summary: string },
    gets: 0,
  };

  const log = (action: string, detail: unknown) => addStep(runId, action, detail);

  const tools = {
    find_agent_manifest: tool({
      description: 'Look for the store\'s agent manifest (<link rel="agent-manifest">) which lists its catalog and HTTP checkout.',
      inputSchema: z.object({ storeUrl: z.string() }),
      execute: async ({ storeUrl }) => {
        try {
          const html = await (await doFetch(storeUrl)).text();
          const tag = html.match(/<link\b[^>]*rel=["']agent-manifest["'][^>]*>/i)?.[0];
          const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
          if (!href) return { found: false, note: 'No agent manifest on this store.' };
          const res = await doFetch(new URL(href, storeUrl).toString());
          if (!res.ok) return { found: false, note: `Manifest returned HTTP ${res.status}` };
          state.manifest = await res.json();
          return { found: true, manifest: state.manifest };
        } catch (e) {
          return { found: false, note: `Could not load store: ${(e as Error).message}` };
        }
      },
    }),
    http_get: tool({
      description: 'GET a URL and return the status and the start of the body (text).',
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        if (++state.gets > 4) return { error: 'Too many page fetches. Stop and call finish.' };
        try {
          const res = await doFetch(url);
          if (!res) return { error: 'No response' };
          const body = await res.text();
          if (res.ok && /"products"\s*:\s*\[\s*\{/.test(body)) state.foundProduct = true;
          return { status: res.status, body: truncate(body.replace(/<head[\s\S]*?<\/head>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, '').replace(/\s(class|style)="[^"]*"/g, '').replace(/\s+/g, ' '), 3500) };
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
    }),
    post_checkout: tool({
      description: 'Start checkout with a cart. Returns the amount and a PayPal approval link (x402 402 Payment Required).',
      inputSchema: z.object({ items: z.array(z.object({ sku: z.string(), qty: z.number().int() })), url: z.string().optional() }),
      execute: async ({ items, url }) => {
        const checkoutUrl = url ?? state.manifest?.checkout?.url;
        if (!checkoutUrl) return { error: 'No checkout URL known. Call find_agent_manifest first.' };
        const res = await doFetch(checkoutUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Lintel-Run': runId }, body: JSON.stringify({ items }) });
        if (res.status !== 402) return { status: res.status, error: (await res.json().catch(() => ({}))).error ?? 'Unexpected response' };
        const header = res.headers.get('PAYMENT-REQUIRED');
        const req: PaymentRequired = header ? decodeHeader(header) : await res.json();
        const a = req.accepts.find((x) => x.scheme === 'paypal-order');
        if (!a) return { error: 'Store does not accept a payment scheme this agent supports.' };
        state.foundProduct = true;
        state.pending = { url: checkoutUrl, items, orderId: a.extra.orderId, nonce: a.extra.nonce, amount: a.amount, approveUrl: a.extra.approveUrl };
        return { status: 402, amount: a.amount, currency: a.asset, payTo: a.payTo, next: 'Call request_payment_approval so the human can approve in PayPal.' };
      },
    }),
    request_payment_approval: tool({
      description: 'Ask the human to approve the pending payment in PayPal, and wait for their approval.',
      inputSchema: z.object({}),
      execute: async () => {
        const p = state.pending;
        if (!p) return { error: 'No pending payment. Call post_checkout first.' };
        setRunStatus(runId, 'awaiting_approval');
        log('approval_requested', { approveUrl: p.approveUrl, amount: p.amount, orderId: p.orderId });
        const r = await waitForApproval(deps.paypal, p.orderId, { timeoutMs: deps.approvalTimeoutMs, pollMs: deps.pollMs });
        setRunStatus(runId, 'running');
        if (r === 'approved') {
          state.approved = true;
          return { approved: true, next: 'Call pay_with_proof.' };
        }
        state.approvalTimedOut = true;
        return { approved: false, note: 'The human did not approve in time. Stop and call finish.' };
      },
    }),
    pay_with_proof: tool({
      description: 'Complete the purchase after approval by sending the PayPal payment proof (x402 PAYMENT-SIGNATURE).',
      inputSchema: z.object({}),
      execute: async () => {
        const p = state.pending;
        if (!p || !state.approved) return { error: 'Payment not approved yet. Call request_payment_approval first.' };
        const proof = encodeHeader({ x402Version: 2, scheme: 'paypal-order', network: 'paypal:sandbox', payload: { orderId: p.orderId, nonce: p.nonce } });
        const res = await doFetch(p.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': proof, 'X-Lintel-Run': runId },
          body: JSON.stringify({ items: p.items }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) state.paid = body;
        return { status: res.status, ...body };
      },
    }),
    finish: tool({
      description: 'End the task with a one-sentence summary for the human.',
      inputSchema: z.object({ success: z.boolean(), summary: z.string() }),
      execute: async (f) => {
        state.finish = f;
        return { ok: true };
      },
    }),
  };

  const outcome = (): LiveOutcome =>
    state.paid ? 'completed' : state.pending ? 'reached_payment' : state.foundProduct ? 'found_product' : 'failed';

  try {
    await generateText({
          model: deps.model ?? resilientModel(),
          maxRetries: 0,
          system: SYSTEM,
          prompt: `Goal: ${args.goal}\nStore URL: ${args.url}`,
          tools,
          prepareStep: ({ messages }: any) => ({ messages: compactMessages(messages, 2) }),
          stopWhen: [stepCountIs(HEADLESS_MAX_STEPS), () => state.finish !== null],
          onStepFinish: (step: any) => {
            for (const tr of step.toolResults ?? []) log(tr.toolName, { input: tr.input, output: tr.output });
          },
        });
  } catch (e) {
    const o = outcome();
    setRunStatus(runId, 'failed', `Agent stopped: ${(e as Error).message}`);
    return o;
  }

  const o = outcome();
  if (o === 'completed') {
    setRunStatus(runId, 'succeeded', state.finish?.summary ?? `Paid $${state.pending?.amount} through PayPal.`);
  } else if (state.approvalTimedOut) {
    setRunStatus(runId, 'failed', 'Payment approval timed out — the agent stopped without paying.');
  } else {
    setRunStatus(runId, 'failed', state.finish?.summary ?? 'The agent could not complete the purchase.');
  }
  return o;
}
