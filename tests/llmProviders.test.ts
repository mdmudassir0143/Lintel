import { describe, it, expect } from 'vitest';
import { loadEnv } from '@/lib/env';
import { parseRetryDelayMs, compactMessages } from '@/lib/llm';

describe('LLM provider config', () => {
  it('prefers Groq models when GROQ_API_KEY is set, Gemini last', () => {
    const e = loadEnv({ GROQ_API_KEY: 'gsk_x', GOOGLE_GENERATIVE_AI_API_KEY: 'g' });
    expect(e.llmModels).toEqual(['groq:openai/gpt-oss-120b', 'groq:qwen/qwen3.8-27b', 'groq:openai/gpt-oss-20b', 'google:gemini-3.5-flash', 'google:gemini-3-flash-preview', 'google:gemini-2.5-flash']);
  });
  it('uses only Gemini without a Groq key', () => {
    expect(loadEnv({ GOOGLE_GENERATIVE_AI_API_KEY: 'g' }).llmModels[0]).toBe('google:gemini-3.5-flash');
  });
  it('LLM_MODELS overrides', () => {
    expect(loadEnv({ LLM_MODELS: 'groq:a, google:b' }).llmModels).toEqual(['groq:a', 'google:b']);
  });
});

describe('retry delay parsing', () => {
  it('reads Groq "try again in" messages and retry-after headers', () => {
    expect(parseRetryDelayMs('Rate limit reached ... Please try again in 7.5s. Need more tokens?')).toBe(7500);
    expect(parseRetryDelayMs('Please try again in 1m2.5s.')).toBe(62500);
    expect(parseRetryDelayMs('Please try again in 450ms.')).toBe(450);
    expect(parseRetryDelayMs(undefined, { 'retry-after': '3' })).toBe(3000);
  });
});

describe('compactMessages', () => {
  const big = 'x'.repeat(5000);
  const toolMsg = (id: string) => ({ role: 'tool' as const, content: [{ type: 'tool-result' as const, toolCallId: id, toolName: 'read_page', output: { type: 'json' as const, value: { text: big } } }] });
  it('shrinks all but the most recent tool results', () => {
    const msgs: any[] = [{ role: 'user', content: 'goal' }, toolMsg('1'), toolMsg('2'), toolMsg('3')];
    const out = compactMessages(msgs, 1);
    expect(JSON.stringify(out[1]).length).toBeLessThan(800);
    expect(JSON.stringify(out[2]).length).toBeLessThan(800);
    expect(JSON.stringify(out[3])).toContain(big);
    expect(out[0]).toEqual(msgs[0]);
    expect((out[1] as any).content[0].toolCallId).toBe('1');
  });
});

import { generateText, APICallError } from 'ai';
import { resilientModel } from '@/lib/llm';
import { scriptedModel, textResult } from './helpers/mockModels';

describe('Groq tool_use_failed', () => {
  it('retries a 400 tool_use_failed instead of failing the run', async () => {
    let n = 0;
    const m = scriptedModel([textResult('recovered')], 'groq-a');
    const orig = m.doGenerate;
    m.doGenerate = async (o: any) => {
      if (n++ === 0) throw new APICallError({ message: 'Failed to parse tool call arguments as JSON', url: 'x', requestBodyValues: {}, statusCode: 400, responseBody: '{"error":{"code":"tool_use_failed"}}' });
      return orig(o);
    };
    const r = await generateText({ model: resilientModel({ models: [m], minIntervalMs: 0, baseDelayMs: 1, maxWaitMs: 500 }), prompt: 'x', maxRetries: 0 });
    expect(r.text).toBe('recovered');
  });
});
