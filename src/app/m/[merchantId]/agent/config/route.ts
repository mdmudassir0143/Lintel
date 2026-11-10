import { CORS_HEADERS } from '@/lib/agentEndpoints';
import { getMerchant } from '@/lib/catalog';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const m = getMerchant(merchantId);
  if (!m || m.installed !== 1) return Response.json({ error: 'not_installed' }, { status: 404, headers: CORS_HEADERS });
  const desc: Record<string, string> = JSON.parse(m.tool_descriptions ?? '{}');
  return Response.json(
    { merchantId, base: env.publicBaseUrl, tools: Object.entries(desc).map(([name, description]) => ({ name, description })) },
    { headers: CORS_HEADERS },
  );
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
