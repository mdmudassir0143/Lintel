# @lintel/agent

Let any AI agent buy from any store that runs Lintel, and pay through PayPal with the
buyer's approval. No dependencies; works in Node 18+, browsers and edge runtimes.

```ts
import { discover, getCatalog, buy } from '@lintel/agent';

const store = await discover('https://fernwoodtea.com');      // finds <link rel="agent-manifest">
const products = await getCatalog(store);                     // SKUs, titles, prices, stock

const receipt = await buy(store, [{ sku: 'FW-SEN-50', qty: 1 }], {
  onApprovalRequired: ({ approveUrl, amount }) => {
    // Show the person this link. Nothing is charged until they approve in PayPal.
    console.log(`Approve $${amount}: ${approveUrl}`);
  },
});
console.log(receipt.captureId);                               // PayPal capture ID
```

## How payment works

Checkout is [x402](https://www.x402.org): the store answers `402 Payment Required` with a `paypal-order`
requirement (a PayPal order for exactly this cart). The person approves it in PayPal; `buy` keeps checking and,
once approved, retries with a `PAYMENT-SIGNATURE` proof. The store verifies the order, amount and cart, captures
the payment, and returns the receipt. Agents never see card numbers or passwords.

## Errors

Every failure is a `LintelError` with a `code`: `no_manifest`, `bad_manifest`, `unsupported_scheme`,
`approval_timeout`, `store_error` (with the HTTP `status` and the store's `error`), or `network`.

## Options

`buy(store, items, { onApprovalRequired, timeoutMs = 15 min, pollMs = 3 s, signal, fetch })`
