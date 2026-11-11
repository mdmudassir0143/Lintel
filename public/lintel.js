/*!
 * Lintel — makes a store buyable by AI agents.
 * Registers WebMCP tools (document.modelContext) for browsing, cart and PayPal checkout.
 * Checkout uses x402 (HTTP 402) settled through PayPal.
 * Install: <script src="https://YOUR-LINTEL/lintel.js" data-merchant="YOUR_ID" async></script>
 */
(function () {
  'use strict';
  var script =
    document.currentScript ||
    document.querySelector('script[data-merchant][src*="lintel.js"]') ||
    document.querySelector('script[src*="lintel.js"][src*="merchant="]') || // added by Shopify's script tag API
    document.querySelector('script[data-merchant]');
  if (!script) return;
  var srcParams = new URL(script.src || location.href, location.href).searchParams;
  var merchant = script.getAttribute('data-merchant') || srcParams.get('merchant');
  if (!merchant) return;
  var base = script.getAttribute('data-base') || srcParams.get('base') || new URL(script.src, location.href).origin;
  var api = base + '/m/' + encodeURIComponent(merchant) + '/agent';
  var CART_KEY = 'lintel_cart_' + merchant;

  // Minimal WebMCP shim for browsers without native support (same surface as the W3C draft).
  if (!document.modelContext) {
    var registry = [];
    document.modelContext = {
      registerTool: function (def) {
        if (!def || !def.name || !def.description) return Promise.reject(new Error('Tool needs name and description'));
        if (registry.some(function (t) { return t.name === def.name; })) return Promise.reject(new Error('Duplicate tool ' + def.name));
        registry.push(def);
        return Promise.resolve();
      },
      getTools: function () {
        return Promise.resolve(registry.map(function (t) {
          return { name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations };
        }));
      },
      executeTool: function (name, args) {
        var t = registry.find(function (x) { return x.name === name; });
        if (!t) return Promise.reject(new Error('No tool named ' + name));
        return Promise.resolve(t.execute(args || {}));
      },
      __lintelShim: true,
    };
  }

  var catalogPromise = null;
  function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(api + '/catalog').then(function (r) { return r.json(); }).then(function (d) { return d.products || []; });
    }
    return catalogPromise;
  }
  // Search helpers: lower-case, "12oz" -> "12 oz", punctuation to spaces.
  var STOP = ['a', 'an', 'the', 'for', 'of', 'and', 'or', 'with', 'to', 'in', 'my', 'some', 'buy', 'want', 'under', 'one', 'bag'];
  function norm(t) {
    return String(t).toLowerCase().replace(/(\d)\s*(oz|lb|lbs|g|kg|ml)\b/g, '$1 $2').replace(/[^a-z0-9.$ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function forms(w) {
    var out = [w];
    ['ian', 'ean', 'an', 'es', 's', 'n'].forEach(function (suf) {
      if (w.length - suf.length >= 4 && w.slice(-suf.length) === suf) out.push(w.slice(0, -suf.length));
    });
    return out;
  }
  function readCart() {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeCart(c) { sessionStorage.setItem(CART_KEY, JSON.stringify(c)); }
  var PENDING_KEY = CART_KEY + ':pending';
  function readPending() {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch (e) { return null; }
  }
  function headers(extra) {
    var h = { 'content-type': 'application/json' };
    if (window.__lintelRunId) h['X-Lintel-Run'] = String(window.__lintelRunId);
    for (var k in extra || {}) h[k] = extra[k];
    return h;
  }
  function summary(p) {
    return { sku: p.sku, title: p.title, price: p.price, currency: p.currency, inStock: p.inStock, description: p.description, attributes: p.attributes };
  }

  var defaults = {
    search_products: 'Search this store\'s products by keyword (name, origin, flavor, size). Returns SKUs and prices.',
    get_product: 'Get full details for one product by SKU.',
    add_to_cart: 'Add a product to the cart by SKU and quantity.',
    view_cart: 'Show the cart with line totals and the order total in USD.',
    checkout_with_paypal: 'Start checkout for the cart. Returns a PayPal approval link the human must approve before payment. Always ask the human first.',
    confirm_payment: 'After the human approved in PayPal, complete the purchase. orderId and nonce default to the last checkout.',
  };

  var tools = [
    {
      name: 'search_products',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      execute: function (a) {
        var words = norm((a && a.query) || '').split(' ').filter(function (w) { return w && STOP.indexOf(w) === -1; });
        return catalog().then(function (ps) {
          if (!words.length) return { products: ps.map(summary) };
          // Rank by how many query words a product matches (with simple word forms), best first.
          var ranked = ps.map(function (p) {
            var hay = norm(p.title + ' ' + p.description + ' ' + JSON.stringify(p.attributes || {}));
            var hits = words.filter(function (w) { return forms(w).some(function (f) { return hay.indexOf(f) !== -1; }); }).length;
            return { p: p, hits: hits };
          }).filter(function (r) { return r.hits > 0; });
          ranked.sort(function (x, y) { return y.hits - x.hits; });
          return { products: ranked.slice(0, 10).map(function (r) { return summary(r.p); }) };
        });
      },
    },
    {
      name: 'get_product',
      inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] },
      execute: function (a) {
        return catalog().then(function (ps) {
          var p = ps.find(function (x) { return x.sku === a.sku; });
          return p ? summary(p) : { error: 'Unknown SKU ' + a.sku };
        });
      },
    },
    {
      name: 'add_to_cart',
      inputSchema: { type: 'object', properties: { sku: { type: 'string' }, qty: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['sku'] },
      execute: function (a) {
        var qty = a.qty == null ? 1 : Number(a.qty);
        return catalog().then(function (ps) {
          var p = ps.find(function (x) { return x.sku === a.sku; });
          if (!p) return { error: 'Unknown SKU ' + a.sku + '. Use search_products to find valid SKUs.' };
          if (!(qty >= 1 && qty <= 20 && Math.floor(qty) === qty)) return { error: 'Quantity must be a whole number from 1 to 20.' };
          var c = readCart();
          var line = c.find(function (l) { return l.sku === a.sku; });
          if (line) line.qty = Math.min(20, line.qty + qty); else c.push({ sku: a.sku, qty: qty });
          writeCart(c);
          return { ok: true, cart: c };
        });
      },
    },
    {
      name: 'view_cart',
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        return catalog().then(function (ps) {
          var total = 0;
          var items = readCart().map(function (l) {
            var p = ps.find(function (x) { return x.sku === l.sku; }) || { title: l.sku, price: '0' };
            var lt = Math.round(Number(p.price) * 100) * l.qty;
            total += lt;
            return { sku: l.sku, title: p.title, qty: l.qty, unit: p.price, total: (lt / 100).toFixed(2) };
          });
          return { items: items, total: (total / 100).toFixed(2), currency: 'USD' };
        });
      },
    },
    {
      name: 'checkout_with_paypal',
      annotations: { consequential: true },
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        var items = readCart();
        if (!items.length) return Promise.resolve({ error: 'Cart is empty.' });
        return fetch(api + '/checkout', { method: 'POST', headers: headers(), body: JSON.stringify({ items: items }) }).then(function (r) {
          return r.json().then(function (body) {
            if (r.status === 402 && body.accepts && body.accepts[0]) {
              var req = body.accepts[0];
              sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderId: req.extra.orderId, nonce: req.extra.nonce }));
              return {
                status: 'approval_required',
                amount: req.amount,
                currency: req.asset,
                approveUrl: req.extra.approveUrl,
                orderId: req.extra.orderId,
                nonce: req.extra.nonce,
                message: 'Ask the human to approve $' + req.amount + ' in PayPal, then call confirm_payment.',
              };
            }
            return { error: body.error || 'Checkout failed (' + r.status + ')' };
          });
        });
      },
    },
    {
      name: 'confirm_payment',
      annotations: { consequential: true },
      inputSchema: { type: 'object', properties: { orderId: { type: 'string' }, nonce: { type: 'string' } } },
      execute: function (a) {
        var last = readPending() || {};
        a = { orderId: (a && a.orderId) || last.orderId, nonce: (a && a.nonce) || last.nonce };
        if (!a.orderId || !a.nonce) return Promise.resolve({ error: 'No checkout to confirm. Call checkout_with_paypal first.' });
        var proof = btoa(JSON.stringify({ x402Version: 2, scheme: 'paypal-order', network: 'paypal:sandbox', payload: { orderId: a.orderId, nonce: a.nonce } }));
        return fetch(api + '/checkout', { method: 'POST', headers: headers({ 'PAYMENT-SIGNATURE': proof }), body: JSON.stringify({ items: readCart() }) }).then(function (r) {
          return r.json().then(function (body) {
            if (r.ok) { writeCart([]); sessionStorage.removeItem(PENDING_KEY); return body; }
            if (r.status === 402) return { status: 'not_approved_yet', message: 'The human has not approved the PayPal payment yet.' };
            return { error: body.error || 'Payment failed (' + r.status + ')' };
          });
        });
      },
    },
  ];

  var state = { merchant: merchant, base: base, tools: [], call: null, ready: null };
  state.call = function (name, args) {
    var t = tools.find(function (x) { return x.name === name; });
    if (!t) return Promise.reject(new Error('No tool named ' + name));
    return Promise.resolve(t.execute(args || {}));
  };
  window.__lintel = state;

  state.ready = fetch(api + '/config')
    .then(function (r) { return r.ok ? r.json() : { tools: [] }; })
    .catch(function () { return { tools: [] }; })
    .then(function (cfg) {
      var custom = {};
      (cfg.tools || []).forEach(function (t) { custom[t.name] = t.description; });
      return Promise.all(tools.map(function (t) {
        var def = { name: t.name, description: custom[t.name] || defaults[t.name], inputSchema: t.inputSchema, annotations: t.annotations, execute: t.execute };
        state.tools.push({ name: def.name, description: def.description, inputSchema: def.inputSchema });
        return Promise.resolve(document.modelContext.registerTool(def)).catch(function () {});
      }));
    })
    .then(function () {});
})();
