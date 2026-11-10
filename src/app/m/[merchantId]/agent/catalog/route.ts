import { handleCatalog, CORS_HEADERS } from '@/lib/agentEndpoints';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ merchantId: string }> }) {
  return handleCatalog((await params).merchantId);
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
