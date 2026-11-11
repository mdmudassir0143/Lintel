/** Session cookie handling and request guards for route handlers and server components. */
import { cookies } from 'next/headers';
import { getUserBySessionToken, SESSION_DAYS, type User } from '../auth';
import { env } from '../env';
import { getStore, canAccessStore } from '../stores';
import type { MerchantRow } from '../catalog';
import { getDb } from '../db';

export const SESSION_COOKIE = 'lintel_session';

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.publicBaseUrl.startsWith('https://'),
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

const deny = (status: number, error: string) => Response.json({ error }, { status });

/** Rejects cross-site form posts to state-changing endpoints (cookies are SameSite=Lax as well). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === new URL(env.publicBaseUrl).host;
  } catch {
    return false;
  }
}

export async function requireUser(req?: Request): Promise<User | Response> {
  if (req && req.method !== 'GET' && !sameOrigin(req)) return deny(403, 'Cross-site request blocked.');
  const user = await currentUser();
  return user ?? deny(401, 'Log in to continue.');
}

export async function requireAdmin(req?: Request): Promise<User | Response> {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  return u.role === 'admin' ? u : deny(403, 'Admins only.');
}

export async function requireStore(id: string, req?: Request): Promise<{ user: User; store: MerchantRow } | Response> {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const store = getStore(id);
  if (!store || !canAccessStore(u, store)) return deny(404, 'Store not found.');
  return { user: u, store };
}

/** A run is visible to admins, its creator, and anyone who can access its store. */
export async function requireRunAccess(runId: string): Promise<User | Response> {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const run = getDb().prepare('select merchant_id, user_id from runs where id = ?').get(runId) as { merchant_id: string | null; user_id: string | null } | undefined;
  if (!run) return deny(404, 'Run not found.');
  const store = run.merchant_id ? getStore(run.merchant_id) : undefined;
  const ok = u.role === 'admin' || run.user_id === u.id || (store ? canAccessStore(u, store) : false);
  return ok ? u : deny(404, 'Run not found.');
}
