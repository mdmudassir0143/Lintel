import { getDb } from '@/lib/db';
import { requireRunAccess } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; idx: string }> }) {
  const { id, idx } = await params;
  const g = await requireRunAccess(id);
  if (g instanceof Response) return g;
  const row = getDb().prepare('select screenshot from steps where run_id = ? and idx = ?').get(id, Number(idx)) as { screenshot: string | null } | undefined;
  const data = row?.screenshot?.match(/^data:image\/jpeg;base64,(.+)$/)?.[1];
  if (!data) return new Response('no screenshot', { status: 404 });
  return new Response(Buffer.from(data, 'base64'), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' } });
}
