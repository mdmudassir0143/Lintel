import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { chromium, type Page, type Browser } from 'playwright-core';
import { resilientModel, compactMessages } from '../llm';
import { env } from '../env';
import type { LiveOutcome } from '../scan/checks';
import type { AgentDeps } from './headless';
import { invokeSiteTool, listSiteTools } from './siteTools';
import { addStep, setRunStatus, setLiveViewUrl, failRun } from './runLog';
import { waitForApproval } from './approval';

export const BROWSER_MAX_STEPS = 20;

export interface OpenedBrowser {
  page: Page;
  close(): Promise<void>;
  liveViewUrl?: string;
}

/** Local Chromium (dev) or a Kernel cloud browser over CDP (deployed; Kernel can't reach localhost). */
export async function openBrowser(): Promise<OpenedBrowser> {
  if (env.browserProvider === 'kernel' && env.kernelApiKey) {
    const { default: Kernel } = await import('@onkernel/sdk');
    const kernel = new Kernel({ apiKey: env.kernelApiKey });
    const kb = await kernel.browsers.create({ stealth: true, timeout_seconds: 1200 });
    const browser: Browser = await chromium.connectOverCDP(kb.cdp_ws_url);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    await page.setViewportSize({ width: 1280, height: 800 }).catch(() => {});
    return {
      page,
      liveViewUrl: kb.browser_live_view_url,
      close: async () => {
        await browser.close().catch(() => {});
        await kernel.browsers.deleteByID(kb.session_id).catch(() => {});
      },
    };
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  return { page, close: () => browser.close() };
}

const SYSTEM = `You are an AI shopping agent using a real web browser for a human.
- First call list_site_tools. If the store offers site tools (WebMCP), use them: search_products, add_to_cart, then checkout_with_paypal.
- Otherwise use the page like a person: read_page, click, type. You may accept a cookie banner.
- Never solve captchas, robot checks, or create accounts or passwords — report them as blockers and finish.
- Only buy what the goal asks for, within budget. Never invent SKUs.
- Payment: after checkout_with_paypal returns approval_required, call request_payment_approval (the human approves in PayPal), then complete_payment.
- Always end by calling finish with success and a one-sentence summary for the human.`;

async function shot(page: Page): Promise<string | undefined> {
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: 40 });
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

export async function runBrowserAgent(args: {
  runId: string;
  url: string;
  goal: string;
  deps: Omit<AgentDeps, 'fetchImpl'> & { open?: () => Promise<OpenedBrowser> };
}): Promise<LiveOutcome> {
  const { runId, deps } = args;
  const state = {
    foundProduct: false,
    addedToCart: false,
    pending: null as null | { orderId: string; nonce: string; amount: string; approveUrl: string },
    approved: false,
    approvalTimedOut: false,
    paid: false,
    finish: null as null | { success: boolean; summary: string },
  };

  let opened: OpenedBrowser;
  try {
    opened = await (deps.open ?? openBrowser)();
  } catch (e) {
    setRunStatus(runId, 'failed', `Could not start a browser: ${(e as Error).message}`);
    return 'not_run';
  }
  const { page } = opened;
  if (opened.liveViewUrl) setLiveViewUrl(runId, opened.liveViewUrl);
  await page.addInitScript(`window.__lintelRunId = ${JSON.stringify(runId)};`);

  const log = async (action: string, detail: unknown, withShot = true) => addStep(runId, action, detail, withShot ? await shot(page) : undefined);

  const settle = async () => {
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
  };

  const siteTools = async () => {
    // Wait for the store's tools to register (lintel.js loads async), then list them.
    await page.evaluate(async () => {
      const w = window as any;
      const d = document as any;
      const until = Date.now() + 4000;
      while (!w.__lintel && !d.modelContext?.getTools && Date.now() < until) await new Promise((r) => setTimeout(r, 200));
      if (w.__lintel?.ready) await Promise.race([w.__lintel.ready, new Promise((r) => setTimeout(r, 3000))]);
    });
    return page.evaluate(listSiteTools);
  };

  const callSite = (name: string, toolArgs: unknown) => page.evaluate(invokeSiteTool, [name, toolArgs ?? {}] as const);

  const observeToolResult = (name: string, out: any) => {
    if (name === 'search_products' && out?.products?.length) state.foundProduct = true;
    if (name === 'get_product' && out?.sku) state.foundProduct = true;
    if (name === 'add_to_cart' && out?.ok) state.addedToCart = state.foundProduct = true;
    if (name === 'checkout_with_paypal' && out?.status === 'approval_required') {
      state.pending = { orderId: out.orderId, nonce: out.nonce, amount: out.amount, approveUrl: out.approveUrl };
    }
    if (name === 'confirm_payment' && out?.status === 'paid') state.paid = true;
  };

  const tools = {
    goto: tool({
      description: 'Open a URL in the browser.',
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await settle();
          return { url: page.url(), title: await page.title() };
        } catch (e) {
          return { error: (e as Error).message.split('\n')[0] };
        }
      },
    }),
    read_page: tool({
      description: 'Read the current page: title, URL, visible text and numbered interactive elements.',
      inputSchema: z.object({}),
      execute: async () =>
        page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role=button]')) as HTMLElement[];
          const visible = els.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
          });
          const lines = visible.slice(0, 45).map((el, i) => {
            el.setAttribute('data-lintel-idx', String(i));
            const input = el as HTMLInputElement;
            const label = (el.innerText || el.getAttribute('aria-label') || input.placeholder || input.value || input.name || '').trim().slice(0, 60);
            const type = input.type ? ` type=${input.type}` : '';
            return `[${i}] <${el.tagName.toLowerCase()}${type}> "${label}"`;
          });
          return { title: document.title, url: location.href, text: document.body.innerText.replace(/\s+/g, ' ')
            .slice(0, 3000), elements: lines };
        }),
    }),
    click: tool({
      description: 'Click an interactive element by its number from read_page.',
      inputSchema: z.object({ index: z.number().int() }),
      execute: async ({ index }) => {
        const sel = `[data-lintel-idx="${index}"]`;
        try {
          const label = (await page.locator(sel).first().innerText({ timeout: 3000 }).catch(() => '')) || '';
          await page.locator(sel).first().click({ timeout: 5000 });
          await settle();
          if (/add to cart/i.test(label)) state.addedToCart = state.foundProduct = true;
          return { clicked: label.trim().slice(0, 60), url: page.url() };
        } catch (e) {
          return { error: `Could not click element ${index}: ${(e as Error).message.split('\n')[0]}. Call read_page again.` };
        }
      },
    }),
    type: tool({
      description: 'Type text into an input by its number from read_page.',
      inputSchema: z.object({ index: z.number().int(), text: z.string() }),
      execute: async ({ index, text }) => {
        try {
          await page.locator(`[data-lintel-idx="${index}"]`).first().fill(text, { timeout: 5000 });
          return { ok: true };
        } catch (e) {
          return { error: (e as Error).message.split('\n')[0] };
        }
      },
    }),
    list_site_tools: tool({
      description: 'List the tools this store offers to AI agents (WebMCP), if any.',
      inputSchema: z.object({}),
      execute: async () => {
        const list = await siteTools().catch(() => []);
        return list.length ? { tools: list } : { tools: 'none — this store offers no agent tools; use read_page/click instead' };
      },
    }),
    call_site_tool: tool({
      description: 'Call one of the store\'s WebMCP tools by name with arguments.',
      inputSchema: z.object({ name: z.string(), args: z.record(z.string(), z.any()).optional() }),
      execute: async ({ name, args: a }) => {
        if (name === 'confirm_payment' && !state.approved) return { error: 'Payment not approved yet. Call request_payment_approval first.' };
        const out = await callSite(name, a ?? {});
        observeToolResult(name, out);
        return out;
      },
    }),
    request_payment_approval: tool({
      description: 'Ask the human to approve the pending PayPal payment and wait for approval.',
      inputSchema: z.object({}),
      execute: async () => {
        const p = state.pending;
        if (!p) return { error: 'No pending payment. Call checkout_with_paypal first.' };
        setRunStatus(runId, 'awaiting_approval');
        await log('approval_requested', { approveUrl: p.approveUrl, amount: p.amount, orderId: p.orderId }, false);
        const r = await waitForApproval(deps.paypal, p.orderId, { timeoutMs: deps.approvalTimeoutMs, pollMs: deps.pollMs });
        setRunStatus(runId, 'running');
        if (r === 'approved') {
          state.approved = true;
          return { approved: true, next: 'Call complete_payment.' };
        }
        state.approvalTimedOut = true;
        return { approved: false, note: 'The human did not approve in time. Stop and call finish.' };
      },
    }),
    complete_payment: tool({
      description: 'After approval, complete the purchase through the store\'s confirm_payment tool.',
      inputSchema: z.object({}),
      execute: async () => {
        const p = state.pending;
        if (!p || !state.approved) return { error: 'Payment not approved yet.' };
        const out = await callSite('confirm_payment', { orderId: p.orderId, nonce: p.nonce });
        observeToolResult('confirm_payment', out);
        return out;
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

  const SHOT_TOOLS = new Set(['goto', 'click', 'type', 'call_site_tool', 'complete_payment']);
  const outcome = (): LiveOutcome =>
    state.paid ? 'completed' : state.pending ? 'reached_payment' : state.addedToCart ? 'added_to_cart' : state.foundProduct ? 'found_product' : 'failed';

  try {
    await tools.goto.execute!({ url: args.url }, { toolCallId: 'initial', messages: [] } as any);
    await log('goto', { input: { url: args.url }, output: { url: page.url(), title: await page.title().catch(() => '') } });

    await generateText({
      model: deps.model ?? resilientModel(),
      maxRetries: 0,
      system: SYSTEM,
      prompt: `Goal: ${args.goal}\nThe store is open in the browser at ${args.url}.`,
      tools,
      prepareStep: ({ messages }: any) => ({ messages: compactMessages(messages, 2) }),
      stopWhen: [stepCountIs(BROWSER_MAX_STEPS), () => state.finish !== null],
      onStepFinish: async (step: any) => {
        for (const tr of step.toolResults ?? []) {
          await log(tr.toolName, { input: tr.input, output: tr.output }, SHOT_TOOLS.has(tr.toolName));
        }
      },
    });
  } catch (e) {
    failRun(runId, e);
    await opened.close().catch(() => {});
    return outcome();
  }
  await opened.close().catch(() => {});

  const o = outcome();
  if (o === 'completed') setRunStatus(runId, 'succeeded', state.finish?.summary ?? `Paid $${state.pending?.amount} through PayPal.`);
  else if (state.approvalTimedOut) setRunStatus(runId, 'failed', 'Payment approval timed out — the agent stopped without paying.');
  else setRunStatus(runId, 'failed', state.finish?.summary ?? 'The agent could not complete the purchase.');
  return o;
}
