import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { withModelFallback, LlmUnavailableError } from '@/lib/llm';
import { failingModel, scriptedModel, textResult } from './helpers/mockModels';

const run = (models: any[], retriesPerModel = 2) =>
  withModelFallback((model) => generateText({ model, prompt: 'hi', maxRetries: 0 }).then((r) => r.text), { models, retriesPerModel, baseDelayMs: 1 });

describe('withModelFallback', () => {
  it('falls back to next model on 503', async () => {
    const a = failingModel(503);
    const b = scriptedModel([textResult('ok')]);
    expect(await run([a, b])).toBe('ok');
    expect(a.doGenerateCalls).toHaveLength(3);
  });

  it('retries 429 then succeeds on same model', async () => {
    let n = 0;
    const flaky = scriptedModel([textResult('fine')]);
    const orig = flaky.doGenerate;
    flaky.doGenerate = async (o: any) => {
      if (n++ === 0) throw (await import('./helpers/mockModels')).apiError(429);
      return orig(o);
    };
    expect(await run([flaky])).toBe('fine');
  });

  it('skips 404 model without retry', async () => {
    const a = failingModel(404);
    const b = scriptedModel([textResult('ok')]);
    expect(await run([a, b])).toBe('ok');
    expect(a.doGenerateCalls).toHaveLength(1);
  });

  it('throws LlmUnavailableError after all models fail', async () => {
    await expect(run([failingModel(503), failingModel(500)])).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('rethrows 400 immediately', async () => {
    const a = failingModel(400);
    const b = scriptedModel([textResult('never')]);
    await expect(run([a, b])).rejects.not.toBeInstanceOf(LlmUnavailableError);
    expect(a.doGenerateCalls).toHaveLength(1);
    expect(b.doGenerateCalls).toHaveLength(0);
  });
});

import { resilientModel, parseRetryDelayMs } from '@/lib/llm';
import { APICallError } from 'ai';

describe('resilientModel', () => {
  const opts = (models: any[], extra: Record<string, number> = {}) => ({ models, minIntervalMs: 0, maxWaitMs: 300, baseDelayMs: 1, ...extra });
  const ask = (model: any) => generateText({ model, prompt: 'hi', maxRetries: 0 }).then((r) => r.text);

  it('moves to next model on 429 without restarting', async () => {
    const a = failingModel(429, 'a');
    const b = scriptedModel([textResult('from-b')], 'b');
    expect(await ask(resilientModel(opts([a, b])))).toBe('from-b');
    expect(a.doGenerateCalls).toHaveLength(1);
  });

  it('keeps a cooled-down model out of later calls', async () => {
    const a = failingModel(429, 'a');
    const b = scriptedModel([textResult('1'), textResult('2')], 'b');
    const m = resilientModel(opts([a, b], { cooldownMs: 10_000 }));
    await ask(m);
    await ask(m);
    expect(a.doGenerateCalls).toHaveLength(1);
    expect(b.doGenerateCalls).toHaveLength(2);
  });

  it('retries a 503 on the same model', async () => {
    let n = 0;
    const a = scriptedModel([textResult('second-try')], 'a');
    const orig = a.doGenerate;
    a.doGenerate = async (o: any) => {
      if (n++ === 0) throw new APICallError({ message: '503', url: 'x', requestBodyValues: {}, statusCode: 503 });
      return orig(o);
    };
    expect(await ask(resilientModel(opts([a])))).toBe('second-try');
  });

  it('throws LlmUnavailableError when every model stays unavailable', async () => {
    await expect(ask(resilientModel(opts([failingModel(429), failingModel(404)])))).rejects.toThrow(/unavailable/i);
  });

  it('paces calls to the same model', async () => {
    const a = scriptedModel([textResult('1'), textResult('2')], 'a');
    const m = resilientModel(opts([a], { minIntervalMs: 120 }));
    const t0 = Date.now();
    await ask(m);
    await ask(m);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(110);
  });

  it('parses Google retryDelay', () => {
    const body = JSON.stringify({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] } });
    expect(parseRetryDelayMs(body)).toBe(37_000);
    expect(parseRetryDelayMs('nope')).toBeUndefined();
  });
});
