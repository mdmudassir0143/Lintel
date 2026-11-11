import { storeState } from '../storeData';
import { AccountWallCheckout, PayPalCheckout } from '../client';
import { R } from '../ui';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  const { installed, catalog } = storeState();
  return (
    <div className="mx-auto max-w-6xl px-5 pt-10">
      <h1 className="mb-2 text-[36px] tracking-tight" style={{ fontFamily: 'var(--rl-display), Georgia, serif' }}>Checkout</h1>
      <p className="mb-8 text-sm" style={{ color: R.muted }}>Roasted on Tuesday, shipped Wednesday.</p>
      {installed ? <PayPalCheckout clientId={env.paypalClientId} catalog={catalog} /> : <AccountWallCheckout />}
    </div>
  );
}
