import { handleCheckout, CORS_HEADERS } from '@/lib/agentEndpoints';
import { paypal } from '@/lib/server/paypal';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ merchantId: string }> }) {
  return handleCheckout(req, (await params).merchantId, { paypal: paypal() });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
