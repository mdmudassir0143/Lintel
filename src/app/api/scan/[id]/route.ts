import { getScan } from '@/lib/scan/runScan';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = getScan((await params).id);
  return s ? Response.json(s) : Response.json({ error: 'not found' }, { status: 404 });
}
