// Fernwood Tea Co. — a small independent shop used to test Lintel like a real merchant would.
// It is a separate codebase: plain Node, no dependencies. Run: node demo-shop/server.mjs  (port 4000)
// Edit head.html to install Lintel; it is re-read on every request, like a theme file.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const products = () => JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const page = (title, body, extraHead = '') => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Fernwood Tea Co.</title>
<style>
  body{margin:0;font:16px/1.6 Georgia,serif;color:#2b2a26;background:#faf8f3}
  header{display:flex;justify-content:space-between;align-items:center;padding:18px 32px;border-bottom:1px solid #e5e0d4;background:#fff}
  header a{color:#2b2a26;text-decoration:none} .brand{font-size:22px;letter-spacing:.02em}
  main{max-width:1000px;margin:0 auto;padding:32px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}
  .card{background:#fff;border:1px solid #e5e0d4;border-radius:8px;padding:18px;color:inherit;text-decoration:none}
  .price{font-weight:bold} .out{color:#9b3b2b} button{font:inherit;padding:10px 16px;border:0;border-radius:6px;background:#3f5a3c;color:#fff;cursor:pointer}
  footer{text-align:center;color:#8a8577;font-size:14px;padding:32px}
</style>
${fs.readFileSync(path.join(dir, 'head.html'), 'utf8')}
${extraHead}
</head><body>
<header><a class="brand" href="/">🍃 Fernwood Tea Co.</a><nav><a href="/">Shop</a> · <a href="/cart">Cart</a></nav></header>
<main>${body}</main>
<footer>Small-batch tea since 2016, Portland, Oregon.</footer>
</body></html>`;

const productLd = (p) => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Product', sku: p.sku, name: p.title, description: p.description,
  offers: { '@type': 'Offer', price: p.price, priceCurrency: 'USD', availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
}).replace(/</g, '\\u003c')}</script>`;

function route(url, base) {
  const u = new URL(url, base);
  const all = products();
  if (u.pathname === '/') {
    return [200, 'text/html', page('Loose-leaf tea', `<h1>Loose-leaf tea</h1><p>Hand-picked teas from small gardens, packed in Portland.</p>
      <div class="grid">${all.map((p) => `<a class="card" href="/products/${p.handle}"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>
      <span class="price">$${p.price}</span>${p.inStock ? '' : ' <span class="out">Sold out</span>'}</a>`).join('')}</div>`)];
  }
  const m = u.pathname.match(/^\/products\/([a-z0-9-]+)$/);
  if (m) {
    const p = all.find((x) => x.handle === m[1]);
    if (!p) return [404, 'text/html', page('Not found', '<h1>Not found</h1>')];
    return [200, 'text/html', page(p.title, `<h1>${esc(p.title)}</h1><p>${esc(p.description)}</p><p class="price">$${p.price}</p>
      ${p.inStock ? '<form action="/cart" method="get"><button>Add to cart</button></form>' : '<p class="out">Sold out</p>'}`, productLd(p))];
  }
  if (u.pathname === '/cart') {
    return [200, 'text/html', page('Cart', '<h1>Your cart</h1><p>Guest checkout. Card payments only.</p><button>Checkout</button>')];
  }
  if (u.pathname === '/robots.txt') return [200, 'text/plain', 'User-agent: *\nAllow: /\nSitemap: ' + base + '/sitemap.xml\n'];
  if (u.pathname === '/sitemap.xml') {
    return [200, 'application/xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${base}/</loc></url>${all.map((p) => `<url><loc>${base}/products/${p.handle}</loc></url>`).join('')}</urlset>`];
  }
  return [404, 'text/plain', 'Not found'];
}

http.createServer((req, res) => {
  const base = `http://${req.headers.host || `localhost:${PORT}`}`;
  try {
    const [status, type, body] = route(req.url || '/', base);
    res.writeHead(status, { 'content-type': `${type}; charset=utf-8` });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error');
  }
}).listen(PORT, () => console.log(`Fernwood Tea Co. running at http://localhost:${PORT}`));
