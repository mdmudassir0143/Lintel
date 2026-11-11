import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Which sign-in options this server has credentials for. */
export function GET() {
  return Response.json({ google: !!(env.googleClientId && env.googleClientSecret), shopify: !!(env.shopifyApiKey && env.shopifyApiSecret) });
}
