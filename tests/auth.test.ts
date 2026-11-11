import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetDbForTests, getDb } from '@/lib/db';
import {
  hashPassword, verifyPassword, createUser, authenticate, createSession, getUserBySessionToken,
  deleteSession, AuthError, allowLoginAttempt, resetLoginLimiterForTests,
} from '@/lib/auth';

describe('passwords', () => {
  it('hashes with a random salt and verifies only the right password', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$/);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('wrong password!!', a)).toBe(false);
    expect(await verifyPassword('anything', 'garbage')).toBe(false);
  });
});

describe('users and sessions', () => {
  beforeEach(() => { resetDbForTests(); resetLoginLimiterForTests(); process.env.ADMIN_EMAILS = 'boss@lintel.test'; });
  afterEach(() => { delete process.env.ADMIN_EMAILS; });

  it('creates a merchant account with a normalized email and never stores the password', async () => {
    const u = await createUser({ email: '  Owner@Shop.TEST ', name: 'Owner', password: 'longenough1' });
    expect(u).toMatchObject({ email: 'owner@shop.test', name: 'Owner', role: 'merchant' });
    const row = getDb().prepare('select * from users where id = ?').get(u.id) as any;
    expect(row.password_hash).not.toContain('longenough1');
  });

  it('gives the admin role to ADMIN_EMAILS', async () => {
    expect((await createUser({ email: 'boss@lintel.test', name: 'B', password: 'longenough1' })).role).toBe('admin');
  });

  it('rejects bad emails, short passwords and duplicate accounts', async () => {
    await expect(createUser({ email: 'nope', name: 'x', password: 'longenough1' })).rejects.toThrow(AuthError);
    await expect(createUser({ email: 'a@b.co', name: 'x', password: 'short' })).rejects.toThrow(/8 characters/);
    await createUser({ email: 'a@b.co', name: 'x', password: 'longenough1' });
    await expect(createUser({ email: 'A@B.co', name: 'y', password: 'longenough1' })).rejects.toThrow(/already/);
  });

  it('authenticates by email and password', async () => {
    await createUser({ email: 'a@b.co', name: 'x', password: 'longenough1' });
    expect((await authenticate('A@b.co', 'longenough1'))?.email).toBe('a@b.co');
    expect(await authenticate('a@b.co', 'wrongwrong')).toBeNull();
    expect(await authenticate('missing@b.co', 'longenough1')).toBeNull();
  });

  it('sessions resolve to the user, are stored hashed, expire, and can be revoked', async () => {
    const u = await createUser({ email: 'a@b.co', name: 'x', password: 'longenough1' });
    const token = createSession(u.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(getDb().prepare('select count(*) n from sessions where id = ?').get(token)).toEqual({ n: 0 });
    expect(getUserBySessionToken(token)?.id).toBe(u.id);
    expect(getUserBySessionToken('forged-token')).toBeNull();
    getDb().prepare('update sessions set expires_at = ?').run(Date.now() - 1);
    expect(getUserBySessionToken(token)).toBeNull();
    const t2 = createSession(u.id);
    deleteSession(t2);
    expect(getUserBySessionToken(t2)).toBeNull();
  });

  it('limits login attempts per key', () => {
    for (let i = 0; i < 10; i++) expect(allowLoginAttempt('1.2.3.4|a@b.co')).toBe(true);
    expect(allowLoginAttempt('1.2.3.4|a@b.co')).toBe(false);
    expect(allowLoginAttempt('5.6.7.8|a@b.co')).toBe(true);
  });
});
