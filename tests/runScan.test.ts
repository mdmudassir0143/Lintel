import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests } from '@/lib/db';
import { createScan, getScan, updateLiveAgentResult } from '@/lib/scan/runScan';
import { getDb } from '@/lib/db';
import { liveAgentCheck } from '@/lib/scan/checks';

describe('scan persistence', () => {
  beforeEach(() => resetDbForTests());

  it('demo store url maps to ridgeline merchant', () => {
    const id = createScan('http://localhost:3000/store/ridgeline');
    expect(getScan(id)!.merchant_id).toBe('ridgeline');
    expect(getScan(createScan('https://other.example'))!.merchant_id).toBeNull();
  });

  it('updateLiveAgentResult replaces live check and rescoring', () => {
    const id = createScan('http://localhost:3000/store/ridgeline');
    getDb().prepare('update scans set checks = ?, status = ? where id = ?').run(JSON.stringify([liveAgentCheck('not_run', '')]), 'done', id);
    updateLiveAgentResult(id, 'reached_payment', 'waited for approval');
    const s = getScan(id)!;
    expect(s.score).toBe(20);
    expect(s.checks.filter((c) => c.id === 'live_agent')).toHaveLength(1);
    expect(s.checks[0].evidence).toContain('waited for approval');
  });
});
