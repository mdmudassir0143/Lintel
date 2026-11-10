import { getRun } from '@/lib/agents/runLog';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const withShots = new URL(req.url).searchParams.get('screenshots') !== '0';
  const r = getRun((await params).id, { screenshots: withShots });
  return r ? Response.json(r) : Response.json({ error: 'not found' }, { status: 404 });
}
