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
