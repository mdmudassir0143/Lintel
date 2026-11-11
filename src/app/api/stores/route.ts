import { requireUser } from '@/lib/server/session';
import { createStore, listStoresFor, storeSummary, StoreError } from '@/lib/stores';
import { startScan } from '@/lib/scan/runScan';
import { assertPublicUrl, UnsafeUrlError } from '@/lib/net';
import { normalizeStoreUrl } from '@/lib/stores';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await requireUser();
  if (u instanceof Response) return u;
  return Response.json({ stores: listStoresFor(u).map(storeSummary) });
}

/** Adds a store for the signed-in merchant and starts its first scan. */
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  try {
    await assertPublicUrl(normalizeStoreUrl(String(b.url ?? '')), { allowHosts: [new URL(env.publicBaseUrl).host] });
    const s = createStore(u, { name: String(b.name ?? ''), url: String(b.url ?? ''), paypalEmail: b.paypalEmail ? String(b.paypalEmail) : undefined });
    const scanId = startScan(s.store_url, { merchantId: s.id, userId: u.id });
    return Response.json({ store: storeSummary(s), scanId });
  } catch (e) {
    if (e instanceof StoreError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof UnsafeUrlError) return Response.json({ error: `That address isn’t a public store: ${e.message}` }, { status: 400 });
    throw e;
  }
}
