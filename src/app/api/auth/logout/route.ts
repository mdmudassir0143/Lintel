import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/auth';
import { SESSION_COOKIE, clearSessionCookie } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  await clearSessionCookie();
  return Response.json({ ok: true });
}
