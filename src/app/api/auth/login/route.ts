import { authenticate, createSession, allowLoginAttempt } from '@/lib/auth';
import { setSessionCookie, sameOrigin } from '@/lib/server/session';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Cross-site request blocked.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? '').trim().toLowerCase();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!allowLoginAttempt(`${ip}|${email}`)) return Response.json({ error: 'Too many attempts. Wait 15 minutes and try again.' }, { status: 429 });
  const user = await authenticate(email, String(b.password ?? ''));
  if (!user && (getDb().prepare("select 1 from users where email = ? and password_hash = ''").get(email))) {
    return Response.json({ error: 'This account signs in with Google or Shopify. Use that button above.' }, { status: 401 });
  }
  if (!user) return Response.json({ error: 'That email and password don’t match an account.' }, { status: 401 });
  await setSessionCookie(createSession(user.id));
  return Response.json({ user });
}
