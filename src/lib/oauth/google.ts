/** Google sign-in: OAuth 2.0 authorization code flow with PKCE. */
import crypto from 'node:crypto';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
}

export function googleAuthUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return u.toString();
}

export interface GoogleProfile { sub: string; email: string; name: string; avatarUrl?: string }

export async function exchangeGoogleCode(o: {
  code: string; verifier: string; redirectUri: string; clientId: string; clientSecret: string; fetchImpl?: FetchLike;
}): Promise<GoogleProfile> {
  const f = o.fetchImpl ?? fetch;
  const tokenRes = await f('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: o.code, client_id: o.clientId, client_secret: o.clientSecret, redirect_uri: o.redirectUri,
      grant_type: 'authorization_code', code_verifier: o.verifier,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!tokenRes.ok || !token.access_token) throw new Error('Google sign-in failed. Try again.');
  const infoRes = await f('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const info = (await infoRes.json().catch(() => ({}))) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!infoRes.ok || !info.sub || !info.email) throw new Error('Google didn’t share your email address.');
  if (info.email_verified !== true) throw new Error('Your Google email isn’t verified yet.');
  return { sub: info.sub, email: info.email.toLowerCase(), name: info.name?.trim() || info.email.split('@')[0], avatarUrl: info.picture };
}
