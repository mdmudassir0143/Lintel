import { requireStore } from '@/lib/server/session';
import { setStorePlatform, StoreError } from '@/lib/stores';

export const dynamic = 'force-dynamic';

/** Saves which store builder the merchant uses, so setup shows the matching steps. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireStore(id, req);
  if (g instanceof Response) return g;
  const b = await req.json().catch(() => ({}));
  try {
    setStorePlatform(id, String(b.platform ?? ''));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof StoreError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
