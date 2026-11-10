import { createGoogleGenerativeAI } from '@ai-sdk/google';
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
let cached: { key: string; models: LanguageModel[] } | null = null;
export function getModels(): LanguageModel[] {
  const key = `${env.googleApiKey}|${env.geminiModels.join(',')}`;
  if (cached?.key !== key) {
    const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });
    cached = { key, models: env.geminiModels.map((id) => google(id)) };
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

/** Google RetryInfo ("37s") from an error response body. */
export function parseRetryDelayMs(body?: string): number | undefined {
  const m = body?.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
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
  const minInterval = opts.minIntervalMs ?? Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 12_000);
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
      const gap = ready.lastCall + minInterval - Date.now();
      if (gap > 0) await sleep(gap);
      for (let attempt = 0; attempt < 3; attempt++) {
        ready.lastCall = Date.now();
        try {
          return await fn(ready.model);
        } catch (e) {
          const status = statusOf(e);
          const id = ready.model.modelId;
          if (status === 429) {
            ready.coolUntil = Date.now() + (parseRetryDelayMs((e as any)?.responseBody) ?? cooldown);
            failures.push(`${id}: 429`);
            break;
          }
          if (status === 404) {
            // Free-tier keys sometimes answer an over-quota request with an empty 404.
            ready.coolUntil = Date.now() + 60_000;
            failures.push(`${id}: 404`);
            break;
          }
          const transient = (status !== undefined && status >= 500) || (status === undefined && isTimeout(e));
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
