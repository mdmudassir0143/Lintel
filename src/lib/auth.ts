/**
 * Accounts and sessions. Passwords are hashed with scrypt; a session is a random token
 * held in an httpOnly cookie, and only its SHA-256 is stored.
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { getDb } from './db';
import { env } from './env';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };
export const SESSION_DAYS = 30;

export type Role = 'merchant' | 'admin';
export interface User { id: string; email: string; name: string; role: Role; created_at: number }

export class AuthError extends Error {
  constructor(message: string, public code: 'invalid_email' | 'weak_password' | 'email_taken' | 'invalid_name') {
    super(message);
    this.name = 'AuthError';
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !n || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const normEmail = (e: string) => e.trim().toLowerCase();
const roleFor = (email: string): Role => (env.adminEmails.includes(email) ? 'admin' : 'merchant');
const publicUser = (r: any): User => ({ id: r.id, email: r.email, name: r.name, role: r.role, created_at: r.created_at });

export async function createUser(input: { email: string; name: string; password: string }): Promise<User> {
  const email = normEmail(input.email);
  const name = input.name.trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) throw new AuthError('Enter a valid email address.', 'invalid_email');
  if (!name) throw new AuthError('Enter your name.', 'invalid_name');
  if (input.password.length < 8) throw new AuthError('Use at least 8 characters for your password.', 'weak_password');
  if (input.password.length > 200) throw new AuthError('That password is too long.', 'weak_password');
  const db = getDb();
  if (db.prepare('select 1 from users where email = ?').get(email)) throw new AuthError('An account with this email already exists. Log in instead.', 'email_taken');
  const user = { id: crypto.randomUUID(), email, name, role: roleFor(email), created_at: Date.now() };
  db.prepare('insert into users (id, email, name, password_hash, role, created_at) values (?, ?, ?, ?, ?, ?)').run(
    user.id, user.email, user.name, await hashPassword(input.password), user.role, user.created_at,
  );
  return user;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const row = getDb().prepare('select * from users where email = ?').get(normEmail(email)) as any;
  if (!row) {
    await hashPassword(password); // similar timing whether or not the account exists
    return null;
  }
  if (!(await verifyPassword(password, row.password_hash))) return null;
  const role: Role = row.role === 'admin' ? 'admin' : roleFor(row.email);
  getDb().prepare('update users set last_login_at = ?, role = ? where id = ?').run(Date.now(), role, row.id);
  return publicUser({ ...row, role });
}

const sha256 = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  getDb().prepare('insert into sessions (id, user_id, created_at, expires_at) values (?, ?, ?, ?)').run(sha256(token), userId, now, now + SESSION_DAYS * 86_400_000);
  return token;
}

export function getUserBySessionToken(token: string | undefined | null): User | null {
  if (!token) return null;
  const row = getDb()
    .prepare('select u.* from sessions s join users u on u.id = s.user_id where s.id = ? and s.expires_at > ?')
    .get(sha256(token), Date.now());
  return row ? publicUser(row) : null;
}

export function deleteSession(token: string): void {
  getDb().prepare('delete from sessions where id = ?').run(sha256(token));
}

// In-memory login limiter: 10 attempts per key per 15 minutes.
const attempts = new Map<string, number[]>();
export function allowLoginAttempt(key: string, max = 10, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
export function resetLoginLimiterForTests() {
  attempts.clear();
}
