import { createUser, createSession, AuthError, allowLoginAttempt } from '@/lib/auth';
import { setSessionCookie, sameOrigin } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Cross-site request blocked.' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!allowLoginAttempt(`signup|${ip}`, 20, 60 * 60_000)) return Response.json({ error: 'Too many sign-ups from here. Try again later.' }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  try {
    const user = await createUser({ email: String(b.email ?? ''), name: String(b.name ?? ''), password: String(b.password ?? '') });
    await setSessionCookie(createSession(user.id));
    return Response.json({ user });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message, field: e.code }, { status: e.code === 'email_taken' ? 409 : 400 });
    throw e;
  }
}
