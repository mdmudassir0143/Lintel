# Lintel — Design

Date: 2026-11-10
Hackathon: PayPal AI Hackathon (Devpost) — deadline **Nov 12, 2026, 12:00 PM PST** per the official Updates page. The user reports an emailed 3-day extension (would be ~Nov 15); unconfirmed on the site. **Plan to Nov 12; treat extra days as polish.**

> Name: **Lintel** (the beam over a doorway — what makes a door usable). Avoid "Agent Ready", a PayPal product name.

## 1. Intent and why

Small merchants are invisible to AI shopping agents. Agents fail on their stores (no structured product data, JS-heavy checkouts, captchas, no machine payment path), so the sale goes elsewhere. PayPal's agentic-commerce push (Agent Ready, Store Sync, WebMCP) only pays off if merchants become agent-buyable, and most SMBs will never do that setup themselves.

**Lintel:** paste your store URL → it scans the store and has a real agent try to buy → shows a score and exactly why agents fail → installs fixes (WebMCP tools + an x402 agent checkout that settles through PayPal) → re-runs the agent, which now buys successfully, with the money landing in the merchant's PayPal account.

Long-term: SaaS for SMB merchants and agencies, with a PayPal partner-channel path. The x402 PayPal scheme is the reusable core: "any merchant can get paid by any agent over HTTP, settled in PayPal."

## 2. Decisions made by the user
- Build idea #3 (agent-readiness for small merchants) combined with x402.
- x402 settlement is **PayPal only (Option A)**: a custom x402 scheme backed by PayPal Orders. **No blockchain, no PYUSD** in scope.
- Product statement: "For small merchants who want AI agents to buy from them. It scans their store, shows why agents fail, installs WebMCP and x402 fixes, then proves the fix by having an agent buy something through PayPal."

## 3. Goals
1. **Scan** any public store URL and produce an Agent-Readiness Score (0–100) with itemized, plain-English findings.
2. **Live agent attempt**: a cloud browser agent (Kernel) tries to find and buy a named product; record each step and the failure point (screenshots + step log).
3. **Fix generation**: produce (a) a WebMCP tools script for the store, (b) a hosted x402 agent-checkout endpoint for the store's catalog, (c) a machine-readable catalog/manifest. AI writes product descriptions and schemas from the scraped catalog.
4. **Install**: on the demo store, fixes install via a single `<script>` tag plus our hosted endpoint (the realistic SMB install path).
5. **Prove**: re-run agents after the fix —
   - Browser agent: discovers WebMCP tools and completes checkout through them.
   - Headless agent: calls the x402 endpoint, receives `402` with a `paypal-order` requirement, gets the order paid, retries, receives an order confirmation.
   - Payment is a real **PayPal sandbox** order, captured into the merchant's sandbox account.
6. **Merchant dashboard**: before/after score, agent run replays, list of agent orders with PayPal order IDs and status.

## 4. Non-goals (for the hackathon)
- Modifying real third-party stores. Real URLs get **read-only scan + score**; install + re-test happens on our own demo store.
- Shopify/WooCommerce app packaging, PayPal partner onboarding (merchants paste sandbox REST credentials or use our demo merchant).
- PYUSD / any blockchain rail.
- PayPal Store Sync integration (requires PayPal sales contact).
- Fulfillment, shipping, tax, inventory sync.
- Multi-tenant auth beyond a simple per-merchant ID.

## 5. Anti-goals (failure even if it "works")
- A demo where the "agent" is scripted clicks — the agent must make real decisions via an LLM.
- PayPal hidden or incidental — PayPal must be visibly the settlement layer in UI, video, and README.
- A scanner that only lists generic SEO tips — findings must be about *agents buying*, each tied to an observed failure or a concrete check.
- Leaked secrets in the repo.
- Anything judges can't run: must have a hosted URL and README run steps.

## 6. Constraints (from hackathon rules)
- Must meaningfully use PayPal developer platform (sandbox) + AI.
- Public GitHub repo, OSS license visible (MIT), README with run instructions and test credentials.
- Public YouTube demo < 3 minutes.
- Working build: hosted URL (Render) and/or local run steps.
- Sponsor prizes: one Grand/Honorable + one Sponsor prize max. Target sponsor: **Render** (hosting/Workflows); **Kernel** used for the browser agent (no Kernel prize exists, but it's a listed tool). Select both on the submission form.

## 7. How it works

### 7.1 Components
1. **Web app (dashboard + scanner UI)** — Next.js (TypeScript). Pages: Home (paste URL), Scan Report, Fix & Install, Agent Run Replay, Merchant Orders.
2. **Scanner service** — fetches the store (HTML, robots.txt, sitemap, JSON-LD), runs deterministic checks, then asks the LLM to analyze findings and extract the catalog.
3. **Agent runner** — two agents, both LLM-driven (Gemini tool-use loop):
   - *Browser agent*: Playwright connected to a Kernel cloud browser over CDP. Tools: navigate, read page (DOM text/accessibility), click, type, screenshot, and — if present — list/invoke WebMCP tools via `document.modelContext.getTools()` / `executeTool()` inside the page.
   - *Headless agent*: HTTP tools only — fetch agent manifest, GET catalog, POST checkout, handle `402`.
   Both emit a step log (step, action, reasoning summary, screenshot URL, outcome).
4. **x402 PayPal facilitator + agent checkout endpoint** — Express/Next route handlers implementing the x402 v2 message shape with a custom scheme.
5. **Demo store** — a small, deliberately agent-unfriendly shop (e.g., an indie coffee roaster) we host. "Before" mode: no JSON-LD, prices rendered client-side, cookie wall, captcha-like gate on checkout, no PayPal. "After" mode: same store with the one-line Lintel script installed (WebMCP tools + PayPal checkout) and the x402 endpoint live.
6. **Storage** — SQLite (or Render Postgres) for scans, runs, step logs, orders.

### 7.2 Scan checks (initial list; builder may refine)
Each check: pass/fail/partial, weight, plain-English "why agents care", evidence.
- AI agents allowed by robots.txt (common agent UAs)
- Product structured data (schema.org Product/Offer JSON-LD) present & valid: name, price, currency, availability
- Prices/availability present in server-rendered HTML (not JS-only)
- Product discoverability: sitemap / product listing reachable without JS
- Blocking interstitials: cookie walls, newsletter modals, bot challenges
- Guest checkout possible (no forced account)
- PayPal available at checkout
- WebMCP tools registered on the page
- Agent manifest / machine catalog endpoint present
- x402-capable agent checkout endpoint present
- Live agent attempt result (largest weight): reached product? added to cart? reached payment? completed?

Score = weighted sum, shown with before/after.

### 7.3 Fix generation
The LLM takes the scraped catalog + findings and produces:
- `lintel.js` config for the store: WebMCP tools — `search_products`, `get_product`, `add_to_cart`, `view_cart`, `checkout_with_paypal` (flagged as consequential; returns a PayPal approval link / opens PayPal button). Loaded with `@w3c/webmcp-polyfill` so it works where native WebMCP isn't enabled.
- JSON-LD product blocks injected by the script.
- Hosted catalog + manifest at `/m/{merchantId}/agent/manifest.json` and `/m/{merchantId}/agent/catalog`.
- AI-cleaned product titles/descriptions/attributes (shown as a diff to the merchant).

### 7.4 x402 PayPal scheme (the core)
Endpoint: `POST /m/{merchantId}/agent/checkout` with `{ items: [{sku, qty}], buyer: {...optional} }`.

1. No payment proof → server creates a PayPal sandbox order (Orders v2, `intent: CAPTURE`, `custom_id` = one-time nonce bound to cart hash + amount), responds:
   ```
   HTTP 402
   PAYMENT-REQUIRED: <base64 JSON>
   {
     "x402Version": 2,
     "accepts": [{
       "scheme": "paypal-order",
       "network": "paypal:sandbox",
       "amount": "24.00",
       "asset": "USD",
       "payTo": "<merchant PayPal merchant ID>",
       "maxTimeoutSeconds": 900,
       "extra": { "orderId": "...", "approveUrl": "https://www.sandbox.paypal.com/checkoutnow?token=...", "nonce": "..." }
     }]
   }
   ```
2. Payer approves the order (see 7.5).
3. Agent retries with `PAYMENT-SIGNATURE: <base64 JSON {scheme, network, payload: {orderId, nonce}}>`.
4. Facilitator verifies: order exists, belongs to merchant, status APPROVED, amount/currency match, `custom_id` nonce matches and unused → captures order → marks nonce used.
5. Server returns `200` with order confirmation and `PAYMENT-RESPONSE` header (capture ID, status).

Header names follow x402 v2 (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`). Builder should check the x402 v2 spec/SDK (`@x402/core`) and either register a custom scheme through the SDK or implement the message shape directly — whichever is faster; conformance to the message shape is what matters.

### 7.5 Who approves the payment
- **Baseline (must work): human-in-the-loop approval link.** Agent surfaces `approveUrl` to the user ("Approve $24.00 at Ridgeline Coffee?"); user approves in PayPal sandbox; agent polls/gets notified, then retries with proof. In the demo, the approval is shown on screen (phone-style panel) — this is a feature: "agents shop, humans approve, PayPal protects."
- **Stretch (only if a day-1 spike passes): autonomous payment** via PayPal vaulted payment method (user links PayPal once; facilitator charges the vault token on each 402). Known risk: `NOT_ENABLED_TO_VAULT_PAYMENT_SOURCE` reported in sandbox by other participants.

### 7.6 AI usage (must be visible to judges)
- The LLM drives both agents (tool-use loop, real decisions).
- The LLM analyzes scan evidence → plain-English findings and prioritized fixes.
- The LLM extracts/cleans the catalog and generates the WebMCP tool definitions.
Model: **Google Gemini Flash via the free AI Studio API key** (no billing; user will not buy an Anthropic key). Free tier is rate-limited (~5–15 requests/min, ~1,000–1,500/day for Flash models as of 2026), so: keep agent loops short (cap steps), cache scan analysis, pre-run demos before recording. Free-tier prompts may be used by Google to improve products — fine, all data is sandbox/demo. Use the Vercel AI SDK (`ai` + `@ai-sdk/google`) so the model is swappable by changing one line; PayPal's Agent Toolkit also supports the Vercel AI SDK. Backup if Gemini limits bite: Elastic's managed LLM inside the hackathon's free Elastic trial (unverified as a general chat API), or another free-tier provider.

### 7.7 Demo video storyline (< 3 min)
1. Problem (15s): "AI agents are the new shoppers. Small stores are invisible to them."
2. Paste demo store URL → agent tries to buy → fails on camera (30s).
3. Score 22/100 with findings (20s).
4. One click: generate fixes; show AI-cleaned catalog + WebMCP tools + x402 endpoint (30s).
5. Install one script tag → re-run: browser agent buys via WebMCP; headless agent hits 402 → PayPal approval → 200 (45s).
6. Merchant dashboard: score 94/100, order captured in PayPal sandbox (20s).
7. Why it matters / PayPal network effect (20s).

## 8. Day-1 spikes (throwaway, decide scope)
1. PayPal sandbox: create order → approve via link → capture, end to end. (Must pass.)
2. PayPal sandbox vault for autonomous charges. (Decides stretch.)
3. Kernel browser + Playwright CDP connect; polyfilled `document.modelContext` tools callable via `executeTool()`. (Fallback: local Playwright Chromium.)

## 9. Schedule (to Nov 12 noon PST)
- **Nov 10 (today/tonight):** spikes; repo scaffold; demo store "before" mode.
- **Nov 11:** scanner + score; x402 PayPal checkout; headless agent; fix generator; browser agent; dashboard.
- **Nov 12 morning:** deploy to Render, README, license, record + upload video by ~9 AM PST, submit.
If the extension is confirmed: use extra days for autonomous vault payments, real-store scanning polish, and dashboard design.

## 10. Left to the builder
- Exact repo layout, libraries, DB choice (SQLite vs Render Postgres).
- Exact check weights and scoring formula.
- Visual design of the dashboard and demo store.
- Whether x402 scheme is registered via `@x402/core` or implemented directly.

## 11. Needs from the user
All free:
- PayPal developer sandbox app: client ID + secret; sandbox business + personal test accounts (developer.paypal.com).
- Google AI Studio API key for Gemini (aistudio.google.com, free, no card).
- Kernel API key + $50 hackathon credits (dashboard.onkernel.com/hackathon?code=KERNELDEVPOST2026).
- Render account + $50 hackathon credits (credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon).
- GitHub account for the public repo.
