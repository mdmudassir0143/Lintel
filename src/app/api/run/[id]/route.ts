import { getRun } from '@/lib/agents/runLog';
import { requireRunAccess } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireRunAccess(id);
  if (g instanceof Response) return g;
  const withShots = new URL(req.url).searchParams.get('screenshots') !== '0';
  const r = getRun(id, { screenshots: withShots });
  return r ? Response.json(r) : Response.json({ error: 'not found' }, { status: 404 });
}
