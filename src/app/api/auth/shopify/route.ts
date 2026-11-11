import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { normalizeShopDomain, shopifyAuthorizeUrl } from '@/lib/oauth/shopify';
import { setOAuthState, currentUser } from '@/lib/server/session';
import { getStore, canAccessStore } from '@/lib/stores';

export const dynamic = 'force-dynamic';

/** Starts "Connect with Shopify". ?shop=your-store[.myshopify.com]; ?store=<id> attaches it to an existing Lintel store. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const user = await currentUser();
  const back = (msg: string) => Response.redirect(`${env.publicBaseUrl}${user ? '/app/stores/new' : '/login'}?error=${encodeURIComponent(msg)}`, 303);
  if (!env.shopifyApiKey || !env.shopifyApiSecret) return back('Shopify connect isn’t set up on this server yet.');
  let shop: string;
  try {
    shop = normalizeShopDomain(q.get('shop') ?? '');
  } catch (e) {
    return back((e as Error).message);
  }
  const storeId = q.get('store') ?? undefined;
  if (storeId) {
    const s = getStore(storeId);
    if (!s || !canAccessStore(user, s)) return back('Store not found.');
  }
  const state = crypto.randomBytes(16).toString('base64url');
  await setOAuthState({ provider: 'shopify', state, shop, storeId });
  return Response.redirect(shopifyAuthorizeUrl({ shop, apiKey: env.shopifyApiKey, redirectUri: `${env.publicBaseUrl}/api/auth/shopify/callback`, state }), 303);
}
