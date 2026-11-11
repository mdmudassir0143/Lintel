import { requireAdmin } from '@/lib/server/session';
import { adminOverview } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await requireAdmin();
  if (u instanceof Response) return u;
  return Response.json(adminOverview());
}
