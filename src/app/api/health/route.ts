import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Render health check: the app is up and the database answers. */
export function GET() {
  try {
    getDb().prepare('select 1').get();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
