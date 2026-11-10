import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; idx: string }> }) {
  const { id, idx } = await params;
  const row = getDb().prepare('select screenshot from steps where run_id = ? and idx = ?').get(id, Number(idx)) as { screenshot: string | null } | undefined;
  const data = row?.screenshot?.match(/^data:image\/jpeg;base64,(.+)$/)?.[1];
  if (!data) return new Response('no screenshot', { status: 404 });
  return new Response(Buffer.from(data, 'base64'), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
}
