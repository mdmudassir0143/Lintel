import { describe, it, expect, afterEach } from 'vitest';
import { trustedHosts } from '@/lib/net';
import { verifyInstall, createStore } from '@/lib/stores';
import { resetDbForTests } from '@/lib/db';
import { createUser } from '@/lib/auth';

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; resetDbForTests(); });

describe('trustedHosts', () => {
  it('trusts Lintel itself, plus DEV_STORE_HOSTS outside production only', () => {
    process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.DEV_STORE_HOSTS = 'localhost:4000, 127.0.0.1:4000';
    (process.env as any).NODE_ENV = 'development';
    expect(trustedHosts()).toEqual(['localhost:3000', 'localhost:4000', '127.0.0.1:4000']);
    (process.env as any).NODE_ENV = 'production';
    expect(trustedHosts()).toEqual(['localhost:3000']);
  });
});

describe('verifyInstall on a password-protected store', () => {
  it('says the store is password-protected instead of “snippet not found”', async () => {
    resetDbForTests();
    const u = await createUser({ email: 'a@shop.test', name: 'A', password: 'longenough1' });
    const s = createStore(u, { name: 'S', url: 'https://s.myshopify.com' });
    const page = '<html><body><form action="/password" method="post"><input name="password" type="password"></form></body></html>';
    const r = await verifyInstall(s.id, async () => new Response(page, { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/password/i);
  });
});
