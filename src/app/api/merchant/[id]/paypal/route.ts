import { requireStore } from '@/lib/server/session';
import { updateStorePaypal, StoreError } from '@/lib/stores';

export const dynamic = 'force-dynamic';

/**
 * Saves the merchant's PayPal business email; agent payments are made out to it.
 * PayPal only rejects an unknown payee when a payment is made, so the account is marked
 * confirmed after the first captured payment (see verifyAndSettle), not here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireStore(id, req);
  if (g instanceof Response) return g;
  if (g.store.owner_id == null) return Response.json({ error: 'The demo store uses Lintel’s sandbox account.' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  try {
    updateStorePaypal(id, String(b.email ?? ''));
  } catch (e) {
    if (e instanceof StoreError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return Response.json({ ok: true, email: String(b.email).trim().toLowerCase() });
}
