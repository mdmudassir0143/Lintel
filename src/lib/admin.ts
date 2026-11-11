/** Read model for the admin console: everything across all accounts. */
import { getDb } from './db';

export function adminOverview() {
  const db = getDb();
  const one = <T>(sql: string) => db.prepare(sql).get() as T;
  const totals = {
    users: one<{ n: number }>('select count(*) n from users').n,
    stores: one<{ n: number }>('select count(*) n from merchants').n,
    storesLive: one<{ n: number }>('select count(*) n from merchants where installed = 1').n,
    scans: one<{ n: number }>("select count(*) n from scans").n,
    runs: one<{ n: number }>('select count(*) n from runs').n,
    runsSucceeded: one<{ n: number }>("select count(*) n from runs where status = 'succeeded'").n,
    orders: one<{ n: number }>('select count(*) n from orders').n,
    revenue: one<{ t: number }>('select coalesce(sum(cast(amount as real)), 0) t from orders').t.toFixed(2),
  };
  const users = db.prepare(`
    select u.id, u.email, u.name, u.role, u.created_at createdAt, u.last_login_at lastLoginAt,
      (select count(*) from merchants m where m.owner_id = u.id) stores
    from users u order by u.created_at desc limit 200`).all() as { id: string; email: string; name: string; role: string; createdAt: number; lastLoginAt: number | null; stores: number }[];
  const stores = (db.prepare(`
    select m.id, m.name, m.store_url storeUrl, m.installed, m.created_at createdAt, m.paypal_email paypalEmail,
      m.install_verified_at installVerifiedAt, u.email ownerEmail,
      (select score from scans s where s.merchant_id = m.id and s.status = 'done' order by s.created_at desc limit 1) score,
      (select count(*) from orders o where o.merchant_id = m.id) orders,
      (select coalesce(sum(cast(amount as real)), 0) from orders o where o.merchant_id = m.id) revenueNum
    from merchants m left join users u on u.id = m.owner_id order by m.created_at desc`).all() as any[])
    .map(({ revenueNum, ...s }) => ({ ...s, installed: s.installed === 1, revenue: Number(revenueNum).toFixed(2) })) as {
      id: string; name: string; storeUrl: string; installed: boolean; createdAt: number | null; paypalEmail: string | null;
      installVerifiedAt: number | null; ownerEmail: string | null; score: number | null; orders: number; revenue: string;
    }[];
  const runs = db.prepare(`
    select r.id, r.merchant_id merchantId, m.name storeName, r.kind, r.status, r.summary, r.created_at createdAt, u.email userEmail
    from runs r left join merchants m on m.id = r.merchant_id left join users u on u.id = r.user_id
    order by r.created_at desc limit 50`).all() as { id: string; merchantId: string | null; storeName: string | null; kind: string; status: string; summary: string | null; createdAt: number; userEmail: string | null }[];
  const orders = db.prepare(`
    select o.id, o.merchant_id merchantId, m.name storeName, o.amount, o.paypal_order_id paypalOrderId, o.capture_id captureId,
      o.payer_email payerEmail, o.run_id runId, o.created_at createdAt
    from orders o left join merchants m on m.id = o.merchant_id order by o.created_at desc limit 50`).all() as {
      id: string; merchantId: string; storeName: string | null; amount: string; paypalOrderId: string; captureId: string; payerEmail: string | null; runId: string | null; createdAt: number;
    }[];
  return { totals, users, stores, runs, orders };
}
