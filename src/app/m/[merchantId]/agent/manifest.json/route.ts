import { handleManifest, CORS_HEADERS } from '@/lib/agentEndpoints';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ merchantId: string }> }) {
  return handleManifest((await params).merchantId, env.publicBaseUrl);
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
