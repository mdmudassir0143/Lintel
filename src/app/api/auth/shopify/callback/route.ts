import { env } from '@/lib/env';
import { getDb } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { encryptSecret } from '@/lib/crypto';
import { findOrCreateOAuthUser, OAuthLinkError } from '@/lib/oauth/accounts';
import { verifyShopifyHmac, exchangeShopifyCode, shopifyShopInfo, shopifyAdminProducts, installShopifyScriptTag, normalizeShopDomain } from '@/lib/oauth/shopify';
import { currentUser, setSessionCookie, takeOAuthState } from '@/lib/server/session';
import { createStore, getStore, canAccessStore, setCatalog } from '@/lib/stores';
import { startScan } from '@/lib/scan/runScan';
import type { MerchantRow } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Shopify sends the merchant back here after they approve. We verify the signature, get an access token,
 * then: account (existing session, or a new one from the shop), store, products, and the storefront script.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const to = (path: string) => Response.redirect(`${env.publicBaseUrl}${path}`, 303);
  const fail = (msg: string) => to(`/login?error=${encodeURIComponent(msg)}`);
  const saved = await takeOAuthState();
  if (!env.shopifyApiKey || !env.shopifyApiSecret) return fail('Shopify connect isn’t set up on this server yet.');
  if (!verifyShopifyHmac(q, env.shopifyApiSecret)) return fail('That Shopify response wasn’t signed correctly.');
  let shop: string;
  try {
    shop = normalizeShopDomain(q.get('shop') ?? '');
  } catch {
    return fail('Unknown Shopify store.');
  }
  if (!saved || saved.provider !== 'shopify' || saved.state !== q.get('state') || saved.shop !== shop || !q.get('code')) return fail('That Shopify link expired. Try again.');

  try {
    const token = await exchangeShopifyCode({ shop, code: q.get('code')!, apiKey: env.shopifyApiKey, apiSecret: env.shopifyApiSecret });
    const info = await shopifyShopInfo(shop, token);
    let user = await currentUser();
    if (!user) {
      user = await findOrCreateOAuthUser({ provider: 'shopify', sub: shop, email: info.email, name: info.shop_owner || info.name, emailVerified: false });
      await setSessionCookie(createSession(user.id));
    }
    const db = getDb();
    let store: MerchantRow | undefined;
    if (saved.storeId) {
      const s = getStore(saved.storeId);
      if (s && canAccessStore(user, s)) store = s;
    }
    store ??= db.prepare('select * from merchants where shopify_shop = ? and owner_id = ?').get(shop, user.id) as MerchantRow | undefined;
    store ??= createStore(user, { name: info.name || shop.replace('.myshopify.com', ''), url: `https://${info.domain || shop}` });
    db.prepare(`update merchants set shopify_shop = ?, shopify_token = ?, platform = 'shopify' where id = ?`).run(shop, encryptSecret(token), store.id);

    try {
      const products = await shopifyAdminProducts(shop, token);
      if (products.length) setCatalog(store.id, products);
    } catch { /* products can be imported later from the setup checklist */ }

    if (env.publicBaseUrl.startsWith('https://')) {
      try {
        const base = env.publicBaseUrl;
        await installShopifyScriptTag(shop, token, `${base}/lintel.js?merchant=${encodeURIComponent(store.id)}&base=${encodeURIComponent(base)}`);
        db.prepare('update merchants set install_verified_at = ? where id = ?').run(Date.now(), store.id);
      } catch { /* the snippet step shows manual instructions */ }
    }
    startScan(getStore(store.id)!.store_url, { merchantId: store.id, userId: user.id });
    return to(`/app/stores/${store.id}?connected=shopify`);
  } catch (e) {
    if (e instanceof OAuthLinkError) return to(`/login?error=${encodeURIComponent(e.message)}&next=${encodeURIComponent(`/api/auth/shopify?shop=${shop}`)}`);
    return fail((e as Error).message || 'Shopify connect failed.');
  }
}
