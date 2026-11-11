import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, resetDbForTests } from '@/lib/db';
import { createRun, setRunStatus, latestRuns } from '@/lib/agents/runLog';

describe('latestRuns', () => {
  beforeEach(() => resetDbForTests());

  it('lists a merchant’s runs newest first, without other merchants’ runs', () => {
    const a = createRun({ kind: 'browser', goal: 'g1', merchantId: 'ridgeline' });
    const b = createRun({ kind: 'headless', goal: 'g2', merchantId: 'ridgeline' });
    createRun({ kind: 'browser', goal: 'other', merchantId: 'someone-else' });
    getDb().prepare('update runs set created_at = ? where id = ?').run(1000, a);
    getDb().prepare('update runs set created_at = ? where id = ?').run(2000, b);
    setRunStatus(a, 'succeeded', 'Bought it.');
    const runs = latestRuns('ridgeline', 10);
    expect(runs.map((r) => r.id)).toEqual([b, a]);
    expect(runs[1]).toMatchObject({ status: 'succeeded', summary: 'Bought it.', kind: 'browser' });
    expect(runs[0]).not.toHaveProperty('live_view_url');
  });

  it('respects the limit', () => {
    for (let i = 0; i < 3; i++) createRun({ kind: 'browser', goal: 'g', merchantId: 'ridgeline' });
    expect(latestRuns('ridgeline', 2)).toHaveLength(2);
  });
});

import { failRun, getRun } from '@/lib/agents/runLog';
import { LlmUnavailableError } from '@/lib/llm';

describe('failRun', () => {
  beforeEach(() => resetDbForTests());

  it('shows the merchant a plain summary and keeps the raw error in the step log', () => {
    const id = createRun({ kind: 'browser', goal: 'g', merchantId: 'ridgeline' });
    failRun(id, Object.assign(new Error('Parsing failed. See failed_generation'), { statusCode: 400 }));
    const { run, steps } = getRun(id)!;
    expect(run.status).toBe('failed');
    expect(run.summary).toBe('The agent hit an unexpected error and stopped. Send it again.');
    expect(run.summary).not.toMatch(/failed_generation/);
    expect(steps.at(-1)).toMatchObject({ action: 'error', detail: { message: 'Parsing failed. See failed_generation' } });
  });

  it('explains a busy AI model separately', () => {
    const id = createRun({ kind: 'headless', goal: 'g' });
    failRun(id, new LlmUnavailableError('The AI model is unavailable right now (x: 429).'));
    expect(getRun(id)!.run.summary).toBe('The AI model was busy, so the agent stopped. Send it again in a minute.');
  });
});
