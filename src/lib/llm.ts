import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import { env } from './env';
import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider';


export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/** Gemini models from GEMINI_MODELS, in fallback order. */
/** Default spacing between calls per provider (free tiers): Groq ≈30 req/min, Gemini ≈5 req/min. */
const PROVIDER_INTERVAL_MS: Record<string, number> = { groq: 2500, google: 12_000 };
const modelInterval = new WeakMap<object, number>();

let cached: { key: string; models: LanguageModel[] } | null = null;
/** Models from LLM_MODELS (provider:model), in fallback order. */
export function getModels(): LanguageModel[] {
  const key = `${env.googleApiKey}|${env.groqApiKey}|${env.llmModels.join(',')}`;
  if (cached?.key !== key) {
    const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });
    const groq = env.groqApiKey ? createGroq({ apiKey: env.groqApiKey }) : null;
    const models: LanguageModel[] = [];
    for (const spec of env.llmModels) {
      const [provider, ...rest] = spec.split(':');
      const id = rest.join(':');
      const m = provider === 'groq' ? groq?.(id) : provider === 'google' ? google(id) : undefined;
      if (!m) continue;
      modelInterval.set(m as object, PROVIDER_INTERVAL_MS[provider] ?? 5000);
      models.push(m);
    }
    cached = { key, models };
  }
  return cached.models; // same instances → shared pacing/cooldowns across features
}

function statusOf(e: unknown): number | undefined {
  const err = e as any;
  return err?.statusCode ?? err?.lastError?.statusCode ?? err?.cause?.statusCode;
}

function isTimeout(e: unknown): boolean {
  const err = e as any;
  return err?.name === 'TimeoutError' || err?.name === 'AbortError' || /timed? ?out|ETIMEDOUT|ECONNRESET|fetch failed/i.test(String(err?.message));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs fn against each model in turn. 429/5xx/timeouts retry with backoff on the same model;
 * 404 (model unavailable) skips straight to the next model; anything else rethrows.
 * Call AI SDK functions inside fn with maxRetries: 0 so retries are not doubled.
 */
export async function withModelFallback<T>(
  fn: (model: LanguageModel) => Promise<T>,
  opts: { models?: LanguageModel[]; retriesPerModel?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const models = opts.models ?? getModels();
  const retries = opts.retriesPerModel ?? 2;
  const base = opts.baseDelayMs ?? 1500;
  const failures: string[] = [];

  for (const model of models) {
    const id = typeof model === 'string' ? model : (model as any).modelId;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn(model);
      } catch (e) {
        const status = statusOf(e);
        if (status === 404) {
          failures.push(`${id}: 404`);
          break;
        }
        const retryable = status === 429 || (status !== undefined && status >= 500) || (status === undefined && isTimeout(e));
        if (!retryable) throw e;
        failures.push(`${id}: ${status ?? 'timeout'}`);
        if (attempt < retries) await sleep(base * 2 ** attempt);
      }
    }
  }
  throw new LlmUnavailableError(`The AI model is unavailable right now (${failures.join(', ')}). Please try again in a minute.`);
}

// ---------------------------------------------------------------------------
// Per-call resilience: one logical model that paces, retries and fails over on
// every request, so multi-step agents never restart from scratch.
// ---------------------------------------------------------------------------

/** Retry hint from Google RetryInfo ("37s"), Groq "try again in 1m2.5s", or a retry-after header. */
export function parseRetryDelayMs(body?: string, headers?: Record<string, string>): number | undefined {
  const g = body?.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (g) return Math.ceil(Number(g[1]) * 1000);
  const t = body?.match(/try again in\s+((?:\d+h)?(?:\d+m(?!s))?(?:\d+(?:\.\d+)?s)?(?:\d+(?:\.\d+)?ms)?)/i)?.[1];
  if (t) {
    const part = (re: RegExp) => Number(t.match(re)?.[1] ?? 0);
    const ms = part(/(\d+)h/) * 3_600_000 + part(/(\d+)m(?!s)/) * 60_000 + part(/(\d+(?:\.\d+)?)s/) * 1000 + part(/(\d+(?:\.\d+)?)ms/);
    if (ms > 0) return Math.ceil(ms);
  }
  const h = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (h && !Number.isNaN(Number(h))) return Math.ceil(Number(h) * 1000);
  return undefined;
}

/**
 * Keeps agent history small (Groq free tier: 8k tokens/min): tool results older than the last
 * `keepLast` tool messages are replaced by a short preview.
 */
export function compactMessages<M extends { role: string; content: any }>(messages: M[], keepLast = 2, previewChars = 400): M[] {
  const toolIdx = messages.map((m, i) => (m.role === 'tool' ? i : -1)).filter((i) => i >= 0);
  const old = new Set(toolIdx.slice(0, Math.max(0, toolIdx.length - keepLast)));
  return messages.map((m, i) => {
    if (!old.has(i) || !Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content.map((p: any) => {
        if (p.type !== 'tool-result') return p;
        const raw = typeof p.output?.value === 'string' ? p.output.value : JSON.stringify(p.output?.value ?? p.output);
        return { ...p, output: { type: 'text', value: raw.length > previewChars ? `${raw.slice(0, previewChars)}…[older result shortened]` : raw } };
      }),
    };
  });
}

interface Slot { model: LanguageModelV4; coolUntil: number; lastCall: number }
const slots = new WeakMap<object, Slot>();

export function resilientModel(opts: {
  models?: LanguageModel[];
  minIntervalMs?: number; // spacing between calls to one model (free tier ≈ 5 req/min)
  maxWaitMs?: number; // give up after this long without a successful call
  cooldownMs?: number; // default cooldown after 429 when Google gives no retryDelay
  baseDelayMs?: number;
} = {}): LanguageModel {
  const intervalFor = (m: object) => opts.minIntervalMs ?? modelInterval.get(m) ?? 5000;
  const maxWait = opts.maxWaitMs ?? 120_000;
  const cooldown = opts.cooldownMs ?? 30_000;
  const base = opts.baseDelayMs ?? 1500;
  const list = (opts.models ?? getModels()).map((m) => {
    const key = m as object;
    let s = slots.get(key);
    if (!s) slots.set(key, (s = { model: m as LanguageModelV4, coolUntil: 0, lastCall: 0 }));
    return s;
  });
  const first = list[0].model;

  async function call<T>(fn: (m: LanguageModelV4) => PromiseLike<T>): Promise<T> {
    const deadline = Date.now() + maxWait;
    const failures: string[] = [];
    while (Date.now() < deadline) {
      const now = Date.now();
      const ready = list.find((s) => s.coolUntil <= now);
      if (!ready) {
        const wake = Math.min(...list.map((s) => s.coolUntil));
        if (wake > deadline) break;
        await sleep(Math.max(1, wake - Date.now()));
        continue;
      }
      const gap = ready.lastCall + intervalFor(ready.model) - Date.now();
      if (gap > 0) await sleep(gap);
      for (let attempt = 0; attempt < 3; attempt++) {
        ready.lastCall = Date.now();
        try {
          return await fn(ready.model);
        } catch (e) {
          const status = statusOf(e);
          const id = ready.model.modelId;
          if (status === 429) {
            ready.coolUntil = Date.now() + (parseRetryDelayMs((e as any)?.responseBody, (e as any)?.responseHeaders) ?? cooldown);
            failures.push(`${id}: 429`);
            break;
          }
          if (status === 413) {
            ready.coolUntil = Date.now() + 15_000;
            failures.push(`${id}: 413`);
            break;
          }
          if (status === 404) {
            // Free-tier keys sometimes answer an over-quota request with an empty 404.
            ready.coolUntil = Date.now() + 60_000;
            failures.push(`${id}: 404`);
            break;
          }
          // Groq answers malformed model tool calls with 400 tool_use_failed: a fresh sample usually works.
          const badToolCall = status === 400 && /tool_use_failed|failed to parse tool call/i.test(`${(e as any)?.responseBody ?? ''} ${(e as any)?.message ?? ''}`);
          const transient = badToolCall || (status !== undefined && status >= 500) || (status === undefined && isTimeout(e));
          if (!transient) throw e;
          failures.push(`${id}: ${status ?? 'timeout'}`);
          if (attempt === 2) {
            ready.coolUntil = Date.now() + 20_000;
            break;
          }
          await sleep(base * 2 ** attempt);
        }
      }
    }
    throw new LlmUnavailableError(`The AI model is unavailable right now (${[...new Set(failures)].join(', ') || 'rate limited'}). Please try again in a minute.`);
  }

  const wrapper: LanguageModelV4 = {
    specificationVersion: 'v4',
    provider: first.provider,
    modelId: list.map((s) => s.model.modelId).join('|'),
    supportedUrls: first.supportedUrls,
    doGenerate: (o: LanguageModelV4CallOptions) => call((m) => m.doGenerate(o)),
    doStream: (o: LanguageModelV4CallOptions) => call((m) => m.doStream(o)),
  };
  return wrapper;
}
