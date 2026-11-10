import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateText, APICallError } from 'ai';
import { CLEAN_SCHEMA, TOOLS_SCHEMA, FINDINGS_SCHEMA, cleanCatalog } from '@/lib/scan/analyze';
import { resilientModel } from '@/lib/llm';
import { RIDGELINE_RAW_CATALOG } from '@/lib/catalog';
import { scriptedModel, textResult } from './helpers/mockModels';

describe('structured-output schemas work with Groq strict mode', () => {
  for (const [name, schema] of Object.entries({ CLEAN_SCHEMA, TOOLS_SCHEMA, FINDINGS_SCHEMA })) {
    it(`${name} has no propertyNames`, () => {
      expect(JSON.stringify(z.toJSONSchema(schema as z.ZodType))).not.toContain('propertyNames');
    });
  }

  it('cleanCatalog maps attribute name/value pairs back to a record', async () => {
    const eth = RIDGELINE_RAW_CATALOG[1];
    const out = { products: [{ sku: eth.sku, title: 'Ethiopia Yirgacheffe', description: 'Floral.', attributes: [{ name: 'origin', value: 'Ethiopia' }, { name: 'process', value: 'Natural' }] }] };
    const r = await cleanCatalog([eth], { models: [scriptedModel([textResult(JSON.stringify(out))])] });
    expect(r[0].attributes).toEqual({ origin: 'Ethiopia', process: 'Natural' });
    expect(r[0].price).toBe('22.00');
  });
});

describe('Groq output_parse_failed', () => {
  it('retries "Parsing failed … failed_generation" instead of failing the run', async () => {
    let n = 0;
    const m = scriptedModel([textResult('ok')], 'groq-x');
    const orig = m.doGenerate;
    m.doGenerate = async (o: any) => {
      if (n++ === 0)
        throw new APICallError({
          message: "Parsing failed. The model generated output that could not be parsed. Please adjust your prompt. See 'failed_generation' for more details.",
          url: 'x', requestBodyValues: {}, statusCode: 400,
          responseBody: '{"error":{"message":"Parsing failed. The model generated output that could not be parsed.","type":"invalid_request_error","code":"output_parse_failed","failed_generation":"..."}}',
        });
      return orig(o);
    };
    const r = await generateText({ model: resilientModel({ models: [m], minIntervalMs: 0, baseDelayMs: 1, maxWaitMs: 500 }), prompt: 'x', maxRetries: 0 });
    expect(r.text).toBe('ok');
  });
});
