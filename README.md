# Lintel

**Make your store buyable by AI agents, and get paid through PayPal.**

Shoppers are starting to send AI agents to find and buy things for them. Most small online stores are invisible to those agents: bots are blocked, prices only appear after JavaScript runs, cookie walls cover the page, and checkout forces an account. The agent gives up and the sale goes elsewhere.

Lintel lets a small merchant:

1. **Scan** their store. Nine checks that matter to AI shoppers, scored out of 100.
2. **Watch** a real AI agent try to buy from it, step by step, in a cloud browser.
3. **Fix** it with one script tag. AI rewrites the catalog so agents can understand it, and the store gets WebMCP tools plus an agent checkout.
4. **Get paid.** Agents pay over HTTP with **x402**, and settlement runs through **PayPal**: the buyer approves in PayPal, and the money lands in the merchant's PayPal account.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## How PayPal is used

Lintel defines an x402 payment scheme, `paypal-order`, that settles through the **PayPal Orders v2 API** (sandbox). No blockchain is involved.

1. An agent `POST`s a cart to `/m/{merchant}/agent/checkout`.
2. Lintel prices the cart, creates a **PayPal order** (`intent: CAPTURE`, `custom_id` = one-time nonce), and answers **`402 Payment Required`**:

   ```json
   {
     "x402Version": 2,
     "accepts": [{
       "scheme": "paypal-order", "network": "paypal:sandbox",
       "amount": "22.00", "asset": "USD", "payTo": "ridgeline", "maxTimeoutSeconds": 900,
       "resource": "https://…/m/ridgeline/agent/checkout",
       "extra": { "orderId": "5O19…", "approveUrl": "https://www.sandbox.paypal.com/checkoutnow?token=5O19…", "nonce": "d357…" }
     }]
   }
   ```

   The same JSON is sent base64-encoded in the `PAYMENT-REQUIRED` header.
3. The **human approves** the payment in PayPal. The agent cannot spend on its own.
4. The agent retries with `PAYMENT-SIGNATURE: base64({ x402Version: 2, scheme: "paypal-order", network: "paypal:sandbox", payload: { orderId, nonce } })`.
5. Lintel verifies the request and only then **captures** the order. It checks that the nonce exists for this merchant, the cart hash is unchanged, the order ID matches, PayPal reports `APPROVED`, and the amount and `custom_id` match. It returns `200` with a `PAYMENT-RESPONSE` receipt that includes the PayPal capture ID.
6. Replaying a proof returns the stored receipt and never captures twice. Swapping the cart after approval is rejected.

The demo store's own human checkout (PayPal JS SDK buttons) uses the **same endpoint**, so people and agents share one payment path.

## How AI is used

- **Shopping agents** (Vercel AI SDK tool-calling loops):
  - A **browser agent** drives a real Chromium. In production that is a [Kernel](https://kernel.sh) cloud browser with live view. The agent reads the page, clicks, and uses the store's WebMCP tools.
  - An **API-only agent** discovers the store's agent manifest and pays through x402.
- **Catalog rewriting:** the LLM turns "ETH YIRG 12OZ - NAT" into "Ethiopia Yirgacheffe — Natural Process, 12 oz" with structured attributes. SKUs, prices and stock are always taken from the merchant's data, never from the model.
- **Findings:** plain-English explanations of what blocks agents and what it costs the merchant.
- **Models:** free tiers only. [Groq](https://console.groq.com) (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`) is primary, with Google Gemini as fallback. Every call is paced, retried, and fails over between models, so an agent never restarts halfway through.

## What gets installed on a store

```html
<script src="https://YOUR-LINTEL/lintel.js" data-merchant="ridgeline" data-base="https://YOUR-LINTEL" async></script>
<link rel="agent-manifest" href="https://YOUR-LINTEL/m/ridgeline/agent/manifest.json">
```

`lintel.js` registers six [WebMCP](https://developer.chrome.com/docs/ai/webmcp) tools through `document.modelContext`, with a built-in fallback for browsers without native support:

- `search_products`
- `get_product`
- `add_to_cart`
- `view_cart`
- `checkout_with_paypal`
- `confirm_payment`

Per-product schema.org `Product` JSON-LD is generated too.

## Try it (hosted)

**Live demo:** `https://<your-render-url>`. Start at the landing page and click **Try it on a demo store**, or **Open app** for the dashboard.

**Sandbox test buyer** (PayPal sandbox only, fake money). Use it when an agent asks you to approve a payment:

- Email: `<sandbox buyer email>`
- Password: `<sandbox buyer password>`

Demo flow:
1. Scan the demo shop. It scores 0.
2. Click **Watch an agent shop in a browser**. The agent fails at the account wall.
3. Click **Fix this store**, then **Install Lintel**.
4. Click **Scan the store** (score 70), then send the agent again.
5. Approve in PayPal. The agent pays, and the score reaches 100.

## Try the API in Postman

[`docs/postman/lintel.postman_collection.json`](docs/postman/lintel.postman_collection.json) walks the full agent purchase over x402 and PayPal. A deployed Lintel also serves it at `/docs/postman`, with `baseUrl` already set to that deployment.

1. **Import** it in Postman. Set `baseUrl` if needed (default `http://localhost:3000`).
2. Send steps 1 to 3 in **Agent checkout**: manifest, catalog, then checkout without payment, which answers `402` with a PayPal approve link (open it from the **Visualize** tab).
3. Approve with a PayPal sandbox buyer, then send step 5. It builds `PAYMENT-SIGNATURE` for you, and the response carries the PayPal capture ID.
4. Steps 6 to 8 show the safety checks: a replayed proof returns the same receipt and never captures twice, a swapped cart gets `cart_mismatch`, and a forged proof gets `unknown_nonce`.

Every request has tests. From the command line: `npx newman run docs/postman/lintel.postman_collection.json`. Steps 5 and 6 pass once the payment has been approved.

## Built with our hackathon partners

- **[Render](https://render.com):** hosts Lintel and the Fernwood demo shop as two web services from `render.yaml`, with `/api/health` as the health check.
- **[Kernel](https://kernel.sh):** cloud browsers for the browser agent (`BROWSER_PROVIDER=kernel`). Merchants watch a real Chromium shop their store through Kernel's live view.
- **[Postman](https://www.postman.com):** the API collection above, which runs the x402 checkout settled through PayPal end to end, with tests.

## Accounts, stores and admin

- **Sign up / log in** with email and password (scrypt-hashed; sessions are random tokens in an httpOnly cookie, stored hashed).
- **Add a store** (name, address, PayPal business email). Lintel scans it right away and the report says what to fix and who fixes it.
- **Setup checklist** on each store: import products (Shopify `/products.json`, schema.org data on the homepage, or CSV), AI rewrite (turns on the agent checkout), add the snippet and **check it on the live site**, save the PayPal account (payments are made out to it; it is marked confirmed after the first captured payment), send a test agent.
- **Admin console** at `/admin` for accounts listed in `ADMIN_EMAILS`: all accounts, stores, agent runs, orders and revenue.
- Merchants only see their own stores (plus the shared demo store). Store addresses must be public; agents and scans never reach private networks.

### Google sign-in and Connect with Shopify

Both are optional and appear only when their keys are set.

- **Google:** in Google Cloud Console, create an OAuth client ID (type *Web application*) with the redirect URI `<PUBLIC_BASE_URL>/api/auth/google/callback`, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Shopify:** in Shopify Partners, create an app with the allowed redirection URL `<PUBLIC_BASE_URL>/api/auth/shopify/callback`, then set `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`. Connecting asks for `read_products` and `write_script_tags`: Lintel imports the products and adds its script to the storefront (needs an `https` `PUBLIC_BASE_URL`). Access tokens are stored encrypted with `LINTEL_SECRET`.

### Data

SQLite with WAL. On Render, `render.yaml` mounts a 1 GB persistent disk at `/var/data` and points `DB_PATH` there, so accounts, stores and orders survive deploys. `/api/health` checks the database.

## Run locally

Requirements: Node 20+, a free PayPal developer sandbox app (a **US** sandbox Business account is required for USD), and a free Groq key and/or Gemini key.

```bash
npm install
npx playwright install chromium        # local browser for the browser agent
cp .env.example .env                   # fill in PAYPAL_CLIENT_ID/SECRET, GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
npx dotenv -e .env -- npm run dev      # http://localhost:3000
npm test                               # 100 tests (one live PayPal sandbox test runs when PAYPAL_CLIENT_ID is set)
```

With `BROWSER_PROVIDER=local` (the default), the browser agent runs a local headless Chromium. `BROWSER_PROVIDER=kernel` uses Kernel cloud browsers; those need a public URL, because they cannot reach `localhost`.

## Deploy (Render)

`render.yaml` defines one web service. Create a Blueprint from this repo, then fill in the secret environment variables. `PUBLIC_BASE_URL` defaults to Render's `RENDER_EXTERNAL_URL`. SQLite on the instance disk is reseeded on boot, which is fine for the demo.

## Tech

Next.js 15 (App Router), TypeScript, Tailwind CSS 4, SQLite (better-sqlite3), Vercel AI SDK v7, Groq and Gemini, Playwright, Kernel, Render, PayPal Orders v2, and x402 v2 message format. API collection for Postman. Tests use Vitest.

Project layout:

- `src/lib/x402/paypalScheme.ts`: the PayPal x402 scheme (create, verify, settle)
- `src/lib/paypal/client.ts`: sandbox Orders client
- `src/lib/scan/*`: scanner, checks, scoring, AI findings
- `src/lib/agents/*`: headless and browser agents
- `public/lintel.js`: the installed script
- `src/app/store/ridgeline`: the demo store (before and after modes)
- `src/app/page.tsx`: landing page; `src/app/app/*`: the dashboard (overview, readiness report, agent run, store); `src/app/docs`: developer docs
- `src/components/*`: design system (brand mark, UI primitives, the lintel score beam)
- `src/app/globals.css` + `src/lib/ui/tokens.ts`: the color template (palette, then roles) and type scale; see it live at `/brand`

## License

MIT. See [LICENSE](LICENSE).
