import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests, getDb } from '@/lib/db';
import { createUser } from '@/lib/auth';
import { createStore } from '@/lib/stores';
import { adminOverview } from '@/lib/admin';

describe('adminOverview', () => {
  beforeEach(() => resetDbForTests());

  it('totals users, stores, runs and revenue, and lists them without password hashes', async () => {
    const a = await createUser({ email: 'a@shop.test', name: 'A', password: 'longenough1' });
    const s = createStore(a, { name: 'Shop A', url: 'a.test' });
    getDb().prepare(`insert into orders (id, merchant_id, paypal_order_id, capture_id, amount, items, created_at) values ('o1', ?, 'P1', 'C1', '22.00', '[]', 1), ('o2', 'ridgeline', 'P2', 'C2', '8.50', '[]', 2)`).run(s.id);
    getDb().prepare(`insert into runs (id, merchant_id, kind, goal, status, created_at) values ('r1', ?, 'browser', 'g', 'succeeded', 1), ('r2', ?, 'browser', 'g', 'failed', 2)`).run(s.id, s.id);
    const o = adminOverview();
    expect(o.totals).toMatchObject({ users: 1, stores: 2, runs: 2, runsSucceeded: 1, orders: 2, revenue: '30.50' });
    expect(o.users[0]).toMatchObject({ email: 'a@shop.test', stores: 1 });
    expect(JSON.stringify(o)).not.toMatch(/scrypt/);
    expect(o.stores.find((x) => x.id === s.id)).toMatchObject({ ownerEmail: 'a@shop.test', orders: 1, revenue: '22.00' });
    expect(o.orders.map((x) => x.id)).toEqual(['o2', 'o1']);
  });
});
