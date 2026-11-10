import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, resetDbForTests } from '@/lib/db';
import { loadEnv } from '@/lib/env';

describe('db', () => {
  beforeEach(() => resetDbForTests());

  it('creates schema and seeds ridgeline', () => {
    const rows = getDb().prepare('select id, installed from merchants').all();
    expect(rows).toEqual([{ id: 'ridgeline', installed: 0 }]);
  });

  it('has all tables', () => {
    const names = getDb()
      .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
      .all()
      .map((r: any) => r.name);
    expect(names).toEqual(['merchants', 'orders', 'payment_nonces', 'runs', 'scans', 'steps']);
  });
});

describe('env', () => {
  it('applies defaults when unset', () => {
    const env = loadEnv({});
    expect(env.geminiModels[0]).toBe('gemini-3.5-flash');
    expect(env.approvalTimeoutMs).toBe(300000);
    expect(env.browserProvider).toBe('local');
    expect(env.publicBaseUrl).toBe('http://localhost:3000');
  });

  it('parses GEMINI_MODELS list', () => {
    expect(loadEnv({ GEMINI_MODELS: 'a, b' }).geminiModels).toEqual(['a', 'b']);
  });
});
