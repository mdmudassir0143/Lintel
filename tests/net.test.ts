import { describe, it, expect, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { isPrivateIp, assertPublicUrl, guardedFetch, UnsafeUrlError } from '@/lib/net';
import { fetchSite } from '@/lib/scan/fetchSite';

const servers: http.Server[] = [];
function serve(handler: http.RequestListener): Promise<{ url: string; host: string }> {
  return new Promise((resolve) => {
    const s = http.createServer(handler).listen(0, '127.0.0.1', () => {
      const port = (s.address() as AddressInfo).port;
      resolve({ url: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}` });
    });
    servers.push(s);
  });
}
afterAll(() => servers.forEach((s) => { s.closeAllConnections?.(); s.close(); }));

describe('private address detection', () => {
  it('flags loopback, private, link-local and v4-mapped v6', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fd00::1', 'fe80::1', '100.64.0.1'])
      expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '151.101.1.1', '2606:4700::1111']) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  it('rejects private targets and non-http schemes', async () => {
    for (const u of ['http://127.0.0.1:9/', 'http://[::ffff:7f00:1]/', 'http://localhost/', 'http://10.0.0.5/x', 'file:///etc/passwd'])
      await expect(assertPublicUrl(u), u).rejects.toBeInstanceOf(UnsafeUrlError);
  });
  it('allows explicitly allowed hosts (Lintel itself)', async () => {
    await expect(assertPublicUrl('http://localhost:3000/store/ridgeline', { allowHosts: ['localhost:3000'] })).resolves.toBeUndefined();
  });
});

describe('guardedFetch', () => {
  it('blocks a redirect hop to a private address', async () => {
    const { url, host } = await serve((_q, r) => { r.writeHead(302, { location: 'http://10.0.0.1/secret' }); r.end(); });
    await expect(guardedFetch(url, {}, { allowHosts: [host] })).rejects.toBeInstanceOf(UnsafeUrlError);
  });
  it('follows allowed redirects', async () => {
    const { url, host } = await serve((q, r) => {
      if (q.url === '/') { r.writeHead(302, { location: '/final' }); return r.end(); }
      r.writeHead(200, { 'content-type': 'text/plain' }); r.end('done');
    });
    const res = await guardedFetch(url, {}, { allowHosts: [host] });
    expect(await res.text()).toBe('done');
  });
  it('times out a server that never answers', async () => {
    const { url, host } = await serve(() => {});
    const t0 = Date.now();
    await expect(guardedFetch(url, {}, { allowHosts: [host], timeoutMs: 200 })).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(1500);
  });
  it('caps huge bodies', async () => {
    const { url, host } = await serve((_q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('x'.repeat(3_000_000)); });
    const res = await guardedFetch(url, {}, { allowHosts: [host], maxBytes: 50_000 });
    expect((await res.text()).length).toBeLessThanOrEqual(50_000);
  });
});

describe('fetchSite uses the guard', () => {
  it('refuses a public-looking scan that redirects to a private address', async () => {
    const { url, host } = await serve((_q, r) => { r.writeHead(301, { location: 'http://169.254.169.254/latest/meta-data' }); r.end(); });
    const s = await fetchSite(url, { allowHosts: [host] });
    expect(s.ok).toBe(false);
    expect(s.error).toMatch(/not publicly reachable/i);
  });
});
