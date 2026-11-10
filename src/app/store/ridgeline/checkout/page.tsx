import { storeState } from '../storeData';
import { AccountWallCheckout, PayPalCheckout } from '../client';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  const { installed, catalog } = storeState();
  return (
    <>
      <h1 className="mb-6 text-3xl">Checkout</h1>
      {installed ? <PayPalCheckout clientId={env.paypalClientId} catalog={catalog} /> : <AccountWallCheckout />}
    </>
  );
}
