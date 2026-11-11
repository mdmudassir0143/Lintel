import { startRun } from '@/lib/agents/runner';
import { requireUser, requireStore } from '@/lib/server/session';
import { agentGoalFor } from '@/lib/stores';
import { assertPublicUrl, UnsafeUrlError, trustedHosts } from '@/lib/net';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Sends an AI agent to buy from one of the signed-in user's stores (or the shared demo store). */
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  if (b.kind !== 'headless' && b.kind !== 'browser') return Response.json({ error: 'kind must be headless or browser' }, { status: 400 });
  if (!b.merchantId) return Response.json({ error: 'Add this store to your account to send an agent.' }, { status: 400 });
  const g = await requireStore(String(b.merchantId));
  if (g instanceof Response) return g;
  try {
    await assertPublicUrl(g.store.store_url, { allowHosts: trustedHosts() });
  } catch (e) {
    if (e instanceof UnsafeUrlError) return Response.json({ error: 'This store’s address isn’t publicly reachable.' }, { status: 400 });
    throw e;
  }
  const runId = startRun({
    kind: b.kind, url: g.store.store_url, goal: agentGoalFor(g.store),
    scanId: typeof b.scanId === 'string' ? b.scanId : undefined, merchantId: g.store.id, userId: u.id,
  });
  return Response.json({ runId });
}
