import type { CheckId } from './checks';

/** How each failing check gets fixed, and by whom. Shown on the readiness report. */
export type Fix = { by: 'lintel' | 'you'; title: string; body: string; snippet?: string; step?: 'catalog' | 'rewrite' | 'snippet' | 'paypal' | 'test' };

export const FIX_GUIDE: Record<CheckId, Fix> = {
  live_agent: { by: 'lintel', title: 'Prove it with a test agent', body: 'Once setup is done, send a real AI agent to buy something. You approve the payment in PayPal.', step: 'test' },
  product_jsonld: {
    by: 'lintel', title: 'Add product data for agents', step: 'snippet',
    body: 'Lintel writes schema.org product data for every product. Add it to your product pages; most Shopify themes already include it.',
  },
  server_rendered_prices: {
    by: 'you', title: 'Put prices in the page HTML',
    body: 'Prices that only appear after JavaScript runs are invisible to many agents. Agents that use Lintel’s tools read prices from your Lintel catalog, so they can still buy while you fix this.',
  },
  no_blocking_interstitial: {
    by: 'you', title: 'Stop the wall covering your pages',
    body: 'Show your cookie banner as a bar instead of a full-page overlay, and turn off robot challenges on product and cart pages.',
  },
  paypal_checkout: { by: 'lintel', title: 'Accept PayPal from agents', body: 'Lintel adds a PayPal checkout for agents. Connect your PayPal business account and payments go straight to it.', step: 'paypal' },
  webmcp_tools: { by: 'lintel', title: 'Give agents tools to shop', body: 'The Lintel snippet adds search, add-to-cart and checkout tools that browser agents call directly.', step: 'snippet' },
  robots_allows_ai: {
    by: 'you', title: 'Let AI agents into robots.txt',
    body: 'Your robots.txt turns AI agents away. Remove the Disallow rules for them, or add these lines:',
    snippet: 'User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /',
  },
  guest_checkout: { by: 'lintel', title: 'Let agents check out without an account', body: 'Agents check out through Lintel without creating an account. Your checkout for people stays as it is.', step: 'snippet' },
  agent_checkout: { by: 'lintel', title: 'Add an agent checkout', body: 'The snippet links API agents to your x402 checkout, which settles in PayPal.', step: 'snippet' },
  site_unreachable: { by: 'you', title: 'Make your store reachable', body: 'We couldn’t load your store. Check that it’s online and public, then scan again.' },
};
