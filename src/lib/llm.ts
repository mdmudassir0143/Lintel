import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { env } from './env';

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/** Gemini models from GEMINI_MODELS, in fallback order. */
export function getModels(): LanguageModel[] {
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });
  return env.geminiModels.map((id) => google(id));
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
