/** Accounts created or found through Google or Shopify instead of a password. */
import crypto from 'node:crypto';
import { getDb } from '../db';
import { env } from '../env';
import type { User } from '../auth';

export class OAuthLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthLinkError';
  }
}

const toUser = (r: any): User => ({ id: r.id, email: r.email, name: r.name, role: r.role, created_at: r.created_at });

/**
 * Google: find by Google id, else link to an account with the same email only when Google verified it.
 * Shopify: a store's email is not proof of identity, so it never links to an existing account; that
 * person logs in first and then connects their store.
 */
export async function findOrCreateOAuthUser(p: {
  provider: 'google' | 'shopify'; sub: string; email: string; name: string; emailVerified: boolean; avatarUrl?: string;
}): Promise<User> {
  const db = getDb();
  const email = p.email.trim().toLowerCase();
  if (p.provider === 'google') {
    const bySub = db.prepare('select * from users where google_sub = ?').get(p.sub);
    if (bySub) {
      db.prepare('update users set last_login_at = ? where id = ?').run(Date.now(), (bySub as any).id);
      return toUser(bySub);
    }
  }
  const byEmail = db.prepare('select * from users where email = ?').get(email) as any;
  if (byEmail) {
    if (p.provider === 'google' && p.emailVerified) {
      db.prepare('update users set google_sub = ?, avatar_url = coalesce(avatar_url, ?), last_login_at = ? where id = ?').run(p.sub, p.avatarUrl ?? null, Date.now(), byEmail.id);
      return toUser(byEmail);
    }
    throw new OAuthLinkError(`An account with ${email} already exists. Log in to it first, then connect.`);
  }
  const user = {
    id: crypto.randomUUID(), email, name: p.name.trim().slice(0, 80) || email.split('@')[0],
    role: env.adminEmails.includes(email) ? 'admin' : 'merchant', created_at: Date.now(),
  } as User;
  db.prepare(
    `insert into users (id, email, name, password_hash, role, created_at, last_login_at, google_sub, avatar_url) values (?, ?, ?, '', ?, ?, ?, ?, ?)`,
  ).run(user.id, user.email, user.name, user.role, user.created_at, user.created_at, p.provider === 'google' ? p.sub : null, p.avatarUrl ?? null);
  return user;
}
