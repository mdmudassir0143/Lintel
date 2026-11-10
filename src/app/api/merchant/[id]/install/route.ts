import { getDb } from '@/lib/db';
import { getMerchant } from '@/lib/catalog';
import { generateFixes, saveFixes, currentBundle } from '@/lib/fixes/generate';
import { cleanCatalog, writeToolDescriptions } from '@/lib/scan/analyze';
import { LlmUnavailableError } from '@/lib/llm';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMerchant(id);
  if (!m) return Response.json({ error: 'unknown merchant' }, { status: 404 });
  return Response.json({ installed: m.installed === 1, bundle: currentBundle(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getMerchant(id)) return Response.json({ error: 'unknown merchant' }, { status: 404 });
  const { installed } = await req.json().catch(() => ({ installed: true }));
  if (installed === false) {
    getDb().prepare('update merchants set installed = 0 where id = ?').run(id);
    return Response.json({ installed: false });
  }
  try {
    const bundle = await generateFixes(id, { cleanCatalog: (raw) => cleanCatalog(raw), writeToolDescriptions: (n, c) => writeToolDescriptions(n, c) });
    saveFixes(id, bundle);
    return Response.json({ installed: true, bundle });
  } catch (e) {
    const msg = e instanceof LlmUnavailableError ? e.message : `Could not generate fixes: ${(e as Error).message}`;
    return Response.json({ error: msg }, { status: 503 });
  }
}
