import { createPayPalClient, type PayPalApi } from '../paypal/client';

let client: PayPalApi | null = null;
/** Shared sandbox client for route handlers (keeps the OAuth token cached). */
export function paypal(): PayPalApi {
  return (client ??= createPayPalClient());
}
