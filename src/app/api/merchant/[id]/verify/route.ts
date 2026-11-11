import { requireStore } from '@/lib/server/session';
import { verifyInstall } from '@/lib/stores';

export const dynamic = 'force-dynamic';

/** Checks the live store for the Lintel snippet. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireStore(id, req);
  if (g instanceof Response) return g;
  return Response.json(await verifyInstall(id));
}
