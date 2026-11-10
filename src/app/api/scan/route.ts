import { startScan } from '@/lib/scan/runScan';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i;

export async function POST(req: Request) {
  const { url } = await req.json().catch(() => ({}));
  let u: URL;
  try {
    u = new URL(String(url).trim().match(/^https?:\/\//i) ? String(url).trim() : `https://${String(url).trim()}`);
  } catch {
    return Response.json({ error: 'Please enter a valid store URL.' }, { status: 400 });
  }
  const own = new URL(env.publicBaseUrl).host === u.host;
  if (!own && PRIVATE.test(u.hostname)) return Response.json({ error: 'That address is not publicly reachable.' }, { status: 400 });
  return Response.json({ scanId: startScan(u.toString()) });
}
