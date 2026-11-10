import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runStaticChecks, liveAgentCheck } from '@/lib/scan/checks';
import { score } from '@/lib/scan/score';

const fx = (n: string) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const snap = (m: string) => ({ url: 'http://x', ok: true, html: fx(`${m}.html`), checkoutHtml: fx(`${m}-checkout.html`), robotsTxt: fx(`${m}-robots.txt`), manifestJson: m === 'after' ? JSON.parse(fx('manifest.json')) : undefined });

describe('score', () => {
  it('before <= 15, after static = 70, after + completed agent = 100', () => {
    expect(score([...runStaticChecks(snap('before')), liveAgentCheck('failed', 'blocked')])).toBeLessThanOrEqual(15);
    expect(score([...runStaticChecks(snap('after')), liveAgentCheck('not_run', '')])).toBe(70);
    expect(score([...runStaticChecks(snap('after')), liveAgentCheck('completed', 'paid')])).toBe(100);
  });

  it('live agent partial credit', () => {
    expect(score([liveAgentCheck('reached_payment', '')])).toBe(20);
    expect(score([liveAgentCheck('added_to_cart', '')])).toBe(10);
    expect(score([liveAgentCheck('found_product', '')])).toBe(5);
  });

  it('partial static checks count half', () => {
    expect(score([{ id: 'product_jsonld', status: 'partial', weight: 15, title: '', why: '', evidence: '' }])).toBe(8);
  });
});
