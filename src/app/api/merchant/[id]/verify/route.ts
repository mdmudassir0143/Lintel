import { requireStore } from '@/lib/server/session';
import { verifyInstall } from '@/lib/stores';
import { startScan } from '@/lib/scan/runScan';

export const dynamic = 'force-dynamic';

/** Checks the live store for the Lintel snippet. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireStore(id, req);
  if (g instanceof Response) return g;
  const result = await verifyInstall(id);
  // Once the snippet is live, rescan so the score reflects it.
  const scanId = result.ok ? startScan(g.store.store_url, { merchantId: id, userId: g.user.id }) : undefined;
  return Response.json({ ...result, scanId });
}
