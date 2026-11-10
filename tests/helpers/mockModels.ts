import { MockLanguageModelV4 } from 'ai/test';
import { APICallError } from 'ai';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

export function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }], finishReason: { unified: 'stop' as const, raw: undefined }, usage, warnings: [] };
}

export function toolCallResult(toolName: string, input: unknown, id = `call-${toolName}-${Math.random().toString(36).slice(2, 7)}`) {
  return {
    content: [{ type: 'tool-call' as const, toolCallId: id, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: 'tool-calls' as const, raw: undefined },
    usage,
    warnings: [],
  };
}

export function apiError(statusCode: number) {
  return new APICallError({ message: `HTTP ${statusCode}`, url: 'https://x', requestBodyValues: {}, statusCode, isRetryable: statusCode >= 500 || statusCode === 429 });
}

/** A model that throws the given HTTP status every call; counts calls. */
export function failingModel(statusCode: number, modelId = `fail-${statusCode}`) {
  const m = new MockLanguageModelV4({ modelId, doGenerate: async () => { throw apiError(statusCode); } });
  return m;
}

/** A model that plays back a script of results, one per call. */
export function scriptedModel(results: unknown[], modelId = 'scripted') {
  let i = 0;
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => (results[Math.min(i++, results.length - 1)] as any),
  });
}
