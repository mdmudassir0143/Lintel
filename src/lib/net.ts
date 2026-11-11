/**
 * Outbound HTTP for anything a user or an AI agent can point at (scans, agent fetches):
 * only public addresses (except explicitly allowed hosts such as Lintel itself), every
 * redirect hop re-checked, with a timeout and a body size cap.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

import { env } from './env';

/**
 * Hosts outbound fetches may reach even though they look private: Lintel itself, and in local
 * development the merchant test shops listed in DEV_STORE_HOSTS. Never extended in production.
 */
export function trustedHosts(): string[] {
  const own = new URL(env.publicBaseUrl).host;
  if (process.env.NODE_ENV === 'production') return [own];
  const dev = (process.env.DEV_STORE_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  return [own, ...dev];
}

export class UnsafeUrlError extends Error {
  constructor(message = 'That address is not publicly reachable.') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

export function isPrivateIp(ip: string): boolean {
  let addr = ip.replace(/^\[|\]$/g, '').toLowerCase();
  const mapped = addr.match(/^::ffff:(.+)$/);
  if (mapped) {
    const rest = mapped[1];
    if (net.isIPv4(rest)) addr = rest;
    else {
      const parts = rest.split(':');
      if (parts.length === 2) {
        const hi = parseInt(parts[0], 16);
        const lo = parseInt(parts[1], 16);
        addr = [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
      }
    }
  }
  if (net.isIPv4(addr)) {
    const n = v4ToInt(addr);
    return V4_BLOCKS.some(([base, bits]) => (n >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits)));
  }
  if (net.isIPv6(addr)) {
    return addr === '::' || addr === '::1' || /^f[cd]/.test(addr) || /^fe[89ab]/.test(addr) || /^ff/.test(addr);
  }
  return true; // not an IP we understand: treat as unsafe
}

export interface GuardOptions {
  allowHosts?: string[]; // host:port values always allowed (Lintel's own host)
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export async function assertPublicUrl(url: string, opts: GuardOptions = {}): Promise<void> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new UnsafeUrlError('Not a valid URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnsafeUrlError('Only http(s) addresses are allowed.');
  if (opts.allowHosts?.includes(u.host)) return;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError();
    return;
  }
  if (/^localhost$|\.localhost$|\.internal$|\.local$/i.test(host)) throw new UnsafeUrlError();
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError('That address could not be found.');
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError();
}

/** fetch with SSRF guard on every redirect hop, timeout, and a body size cap. */
export async function guardedFetch(url: string, init: RequestInit = {}, opts: GuardOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  let method = init.method ?? 'GET';
  let body = init.body;
  for (let hop = 0; hop <= (opts.maxRedirects ?? 5); hop++) {
    await assertPublicUrl(current, opts);
    const res = await fetch(current, { ...init, method, body, redirect: 'manual', signal });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, current).toString();
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      await res.body?.cancel().catch(() => {});
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (size < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
      await reader.cancel().catch(() => {});
    }
    const buf = Buffer.concat(chunks).subarray(0, maxBytes);
    const out = new Response(res.status === 204 || res.status === 304 ? null : buf, { status: res.status, statusText: res.statusText, headers: res.headers });
    Object.defineProperty(out, 'url', { value: current });
    return out;
  }
  throw new UnsafeUrlError('Too many redirects.');
}
