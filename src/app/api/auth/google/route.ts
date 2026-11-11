import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { googleAuthUrl, pkcePair } from '@/lib/oauth/google';
import { setOAuthState, safeNext } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const back = (msg: string) => Response.redirect(`${env.publicBaseUrl}/login?error=${encodeURIComponent(msg)}`, 303);
  if (!env.googleClientId || !env.googleClientSecret) return back('Google sign-in isn’t set up on this server yet.');
  const { verifier, challenge } = pkcePair();
  const state = crypto.randomBytes(16).toString('base64url');
  await setOAuthState({ provider: 'google', state, verifier, next: safeNext(new URL(req.url).searchParams.get('next')) });
  return Response.redirect(googleAuthUrl({ clientId: env.googleClientId, redirectUri: `${env.publicBaseUrl}/api/auth/google/callback`, state, challenge }), 303);
}
