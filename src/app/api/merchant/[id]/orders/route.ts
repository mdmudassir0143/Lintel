import { getDb } from '@/lib/db';
import { requireStore } from '@/lib/server/session';
import { storeSummary } from '@/lib/stores';
import { env } from '@/lib/env';
import { latestScans } from '@/lib/scan/runScan';
import { latestRuns } from '@/lib/agents/runLog';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireStore(id);
  if (g instanceof Response) return g;
  const m = g.store;
  const orders = (getDb().prepare('select * from orders where merchant_id = ? order by created_at desc limit 50').all(id) as any[]).map((o) => ({ ...o, items: JSON.parse(o.items) }));
  const scans = latestScans(id, 8).map((s) => ({ id: s.id, score: s.score, created_at: s.created_at }));
  const runs = latestRuns(id, 12);
  return Response.json({ runs, providers: { shopify: !!(env.shopifyApiKey && env.shopifyApiSecret) }, summary: storeSummary(m), merchant: { id: m.id, name: m.name, storeUrl: m.store_url, installed: m.installed === 1, raw: JSON.parse(m.raw_catalog), isDemo: m.owner_id == null, paypalEmail: m.paypal_email }, orders, scans });
}
