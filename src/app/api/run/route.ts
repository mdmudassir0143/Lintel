import { startRun } from '@/lib/agents/runner';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.kind !== 'headless' && b.kind !== 'browser') return Response.json({ error: 'kind must be headless or browser' }, { status: 400 });
  let url: string;
  try {
    url = new URL(String(b.url)).toString();
  } catch {
    return Response.json({ error: 'A valid store url is required' }, { status: 400 });
  }
  const runId = startRun({ kind: b.kind, url, goal: typeof b.goal === 'string' ? b.goal.slice(0, 300) : undefined, scanId: b.scanId, merchantId: b.merchantId });
  return Response.json({ runId });
}
