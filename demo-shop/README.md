# Fernwood Tea Co. (test shop)

A small, separate shop for testing Lintel the way a real merchant uses it. Plain Node, no dependencies.

```bash
node demo-shop/server.mjs      # http://localhost:4000
```

To install Lintel: copy the snippet from your store's setup page in Lintel, paste it into `demo-shop/head.html`
(below the comment), save, then click **Check my store** in Lintel. No restart needed.

Lintel reaches local shops only when `DEV_STORE_HOSTS=localhost:4000` is set in Lintel's `.env`, and never in production.
