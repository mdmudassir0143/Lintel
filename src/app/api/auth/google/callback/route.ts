import { env } from '@/lib/env';
import { createSession } from '@/lib/auth';
import { exchangeGoogleCode } from '@/lib/oauth/google';
import { findOrCreateOAuthUser } from '@/lib/oauth/accounts';
import { setSessionCookie, takeOAuthState, safeNext } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const back = (msg: string) => Response.redirect(`${env.publicBaseUrl}/login?error=${encodeURIComponent(msg)}`, 303);
  const q = new URL(req.url).searchParams;
  const saved = await takeOAuthState();
  if (q.get('error')) return back('Google sign-in was cancelled.');
  if (!saved || saved.provider !== 'google' || !saved.state || saved.state !== q.get('state') || !q.get('code')) return back('That sign-in link expired. Try again.');
  try {
    const profile = await exchangeGoogleCode({
      code: q.get('code')!, verifier: saved.verifier!, redirectUri: `${env.publicBaseUrl}/api/auth/google/callback`,
      clientId: env.googleClientId!, clientSecret: env.googleClientSecret!,
    });
    const user = await findOrCreateOAuthUser({ provider: 'google', sub: profile.sub, email: profile.email, name: profile.name, emailVerified: true, avatarUrl: profile.avatarUrl });
    await setSessionCookie(createSession(user.id));
    return Response.redirect(`${env.publicBaseUrl}${safeNext(saved.next)}`, 303);
  } catch (e) {
    return back((e as Error).message || 'Google sign-in failed.');
  }
}
