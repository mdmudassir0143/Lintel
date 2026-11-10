export interface SiteSnapshot {
  url: string;
  ok: boolean;
  status?: number;
  html?: string;
  robotsTxt?: string;
  checkoutHtml?: string;
  manifestJson?: any;
  error?: string;
}

import { guardedFetch, UnsafeUrlError } from '../net';

const UA = 'LintelScanner/0.1 (agent-readiness check)';

async function get(url: string, timeoutMs: number, maxBytes: number, allowHosts?: string[]) {
  const res = await guardedFetch(
    url,
    { headers: { 'user-agent': UA, accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5' } },
    { timeoutMs, maxBytes, allowHosts },
  );
  const text = (await res.text()).slice(0, maxBytes);
  return { res, text, contentType: res.headers.get('content-type') ?? '' };
}

function findLink(html: string, base: string, test: (href: string, text: string) => boolean): string | undefined {
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (test(m[1], text)) {
      try {
        return new URL(m[1], base).toString();
      } catch {}
    }
  }
  return undefined;
}

function manifestHref(html: string): string | undefined {
  const m = html.match(/<link\b[^>]*rel=["']agent-manifest["'][^>]*>/i);
  return m?.[0].match(/href=["']([^"']+)["']/i)?.[1];
}

/** Fetches a store's home page, robots.txt, checkout/cart page and agent manifest. Never throws. */
export async function fetchSite(url: string, opts: { timeoutMs?: number; maxBytes?: number; allowHosts?: string[] } = {}): Promise<SiteSnapshot> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
  } catch {
    return { url, ok: false, error: 'Not a valid http(s) URL' };
  }

  let home;
  try {
    home = await get(parsed.toString(), timeoutMs, maxBytes, opts.allowHosts);
  } catch (e) {
    if (e instanceof UnsafeUrlError) return { url, ok: false, error: e.message };
    return { url, ok: false, error: `Could not reach the site: ${(e as Error).name === 'TimeoutError' ? 'timed out' : (e as Error).message}` };
  }
  if (!home.res.ok) return { url, ok: false, status: home.res.status, error: `Site returned HTTP ${home.res.status}` };
  if (!/text\/html|application\/xhtml/i.test(home.contentType)) {
    return { url, ok: false, status: home.res.status, error: `Unexpected content type: ${home.contentType || 'none'}` };
  }
  const finalUrl = home.res.url || parsed.toString();
  const snap: SiteSnapshot = { url, ok: true, status: home.res.status, html: home.text };

  const tryText = async (u: string) => {
    try {
      const r = await get(u, timeoutMs, maxBytes, opts.allowHosts);
      return r.res.ok ? r : null;
    } catch {
      return null;
    }
  };

  const pathRobots = new URL('robots.txt', finalUrl.endsWith('/') ? finalUrl : finalUrl + '/').toString();
  const rootRobots = new URL('/robots.txt', finalUrl).toString();
  for (const r of [...new Set([pathRobots, rootRobots])]) {
    const got = await tryText(r);
    if (got && /text\/plain/i.test(got.contentType)) {
      snap.robotsTxt = got.text;
      break;
    }
  }

  const checkout = findLink(home.text, finalUrl, (href, text) => /checkout|cart|basket|bag/i.test(href) || /checkout|cart|basket/i.test(text));
  if (checkout) snap.checkoutHtml = (await tryText(checkout))?.text;

  const mh = manifestHref(home.text);
  if (mh) {
    const got = await tryText(new URL(mh, finalUrl).toString());
    try {
      if (got) snap.manifestJson = JSON.parse(got.text);
    } catch {}
  }
  return snap;
}
