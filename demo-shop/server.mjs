// Fernwood Tea Co. — a small independent tea shop used to test Lintel the way a real merchant does.
// Separate codebase: plain Node, no dependencies. Run: node demo-shop/server.mjs (PORT, default 4000).
// Theme <head> code comes from the HEAD_HTML environment variable if set (how a hosted shop's
// "custom code" setting works), otherwise from head.html, re-read on every request.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const products = () => JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'));
const headCode = () => process.env.HEAD_HTML ?? fs.readFileSync(path.join(dir, 'head.html'), 'utf8');
const headFile = path.join(dir, 'head.html');
// The theme editor is a local-only stand-in for a shop admin's "custom code" setting. It is off on
// Render and whenever HEAD_HTML is set, so the public store can't be edited by visitors.
const editorOn = () => !process.env.RENDER && process.env.HEAD_HTML == null;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const C = { paper: '#f4f1ea', card: '#fbfaf6', ink: '#24221e', muted: '#6e695f', line: '#e2ddd1', olive: '#4f5d2f', oliveDark: '#3d4824', tea: '#8a5a3b' };

/** Illustrated tea tin (or a cast-iron pot for teaware). */
function art(p, size = 'md') {
  const h = { sm: 90, md: 240, lg: 440 }[size];
  if (p.category === 'Teaware') {
    return `<div class="art" style="height:${h}px"><svg viewBox="0 0 200 200" style="height:78%"><ellipse cx="100" cy="182" rx="66" ry="8" fill="#000" opacity=".08"/>
      <path d="M48 110c0-34 24-52 52-52s52 18 52 52-22 64-52 64-52-30-52-64z" fill="#2f2f2f"/><circle cx="100" cy="58" r="10" fill="#2f2f2f"/>
      <path d="M150 104c22 2 30 18 26 32" stroke="#2f2f2f" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M62 66c4-30 72-30 76 0" stroke="#4a4a4a" stroke-width="5" fill="none"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${70 + i * 12}" cy="120" r="3" fill="#444"/>`).join('')}</svg></div>`;
  }
  return `<div class="art" style="height:${h}px"><svg viewBox="0 0 200 220" style="height:84%"><ellipse cx="100" cy="208" rx="54" ry="7" fill="#000" opacity=".09"/>
    <rect x="52" y="34" width="96" height="172" rx="10" fill="#ece6da"/><rect x="48" y="26" width="104" height="22" rx="6" fill="${p.band}"/>
    <rect x="52" y="78" width="96" height="74" fill="${p.band}"/>
    <text x="100" y="106" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="13" fill="#fff" letter-spacing="2">FERNWOOD</text>
    <text x="100" y="128" text-anchor="middle" font-family="Karla, sans-serif" font-size="9" fill="#fff" opacity=".9">${esc(p.category.toUpperCase())} TEA</text>
    <path d="M86 176c8-14 20-14 28 0" stroke="${p.band}" stroke-width="2" fill="none"/><path d="M100 176v-16" stroke="${p.band}" stroke-width="2"/></svg></div>`;
}

const page = (title, body, { extraHead = '', description = 'Small-batch loose-leaf tea from Portland, Oregon.' } = {}) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Fernwood Tea Co.</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Karla:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box} body{margin:0;font:16px/1.6 Karla,system-ui,sans-serif;color:${C.ink};background:${C.paper}}
  a{color:inherit} h1,h2,h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;letter-spacing:-.01em;margin:0}
  .wrap{max-width:1120px;margin:0 auto;padding:0 20px}
  .bar{background:${C.olive};color:#f4f1ea;text-align:center;font-size:13px;padding:8px 16px;letter-spacing:.02em}
  header{position:sticky;top:0;z-index:10;background:rgba(244,241,234,.94);backdrop-filter:blur(6px);border-bottom:1px solid ${C.line}}
  header .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
  .logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600}
  nav a{text-decoration:none;margin-left:26px;font-size:15px} nav a:hover{opacity:.65}
  .count[hidden]{display:none}
  .count{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:${C.olive};color:#fff;font-size:11px;font-weight:700;margin-left:4px}
  .btn{display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 28px;border-radius:99px;border:0;background:${C.olive};color:#f4f1ea;font:700 15px Karla,sans-serif;text-decoration:none;cursor:pointer}
  .btn:hover{background:${C.oliveDark}} .btn.ghost{background:transparent;color:${C.ink};border:1px solid ${C.ink}}
  .muted{color:${C.muted}} .art{display:flex;align-items:flex-end;justify-content:center;background:#e9e3d6;border-radius:16px;overflow:hidden;box-shadow:inset 0 -60px 0 #e2dacb}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:28px}
  .card{text-decoration:none;display:block} .card:hover .art{transform:translateY(-3px)} .art{transition:transform .3s}
  .card .row{display:flex;justify-content:space-between;gap:14px;margin-top:14px;font-weight:700}
  .tag{display:inline-block;font-size:12px;padding:2px 10px;border-radius:99px;border:1px solid ${C.line};color:${C.muted};margin-top:8px}
  .out{color:#9b3b2b} section{padding:64px 0} .panel{background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:36px}
  input{font:inherit;height:46px;border:1px solid ${C.line};border-radius:10px;padding:0 14px;background:#fff;width:100%}
  footer{background:${C.oliveDark};color:#f4f1ea;margin-top:80px} footer .wrap{padding:52px 20px;display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:36px}
  footer a{text-decoration:none;opacity:.8;display:block;margin-top:6px;font-size:14px} footer p{font-size:14px;opacity:.8}
  @media(max-width:760px){footer .wrap{grid-template-columns:1fr} .three{grid-template-columns:1fr!important} .panel{padding:24px} nav .hide{display:none} .split{grid-template-columns:1fr!important} h1{font-size:44px!important}}
</style>
${headCode()}
${extraHead}
</head><body>
<div class="bar">Free shipping on orders over two tins. Packed by hand in Portland.</div>
<header><div class="wrap">
  <a class="logo" href="/"><svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="${C.olive}"/><path d="M16 7c5 4 7 9 0 18-7-9-5-14 0-18z" fill="#f4f1ea"/><path d="M16 11v13" stroke="${C.olive}" stroke-width="1.4"/></svg>Fernwood Tea Co.</a>
  <nav><a class="hide" href="/#shop">Shop tea</a><a class="hide" href="/#teaware">Teaware</a><a class="hide" href="/#story">Our story</a><a href="/cart">Cart<span class="count" data-cart-count hidden>0</span></a></nav>
</div></header>
<main>${body}</main>
<footer><div class="wrap">
  <div><div class="logo" style="color:#f4f1ea">Fernwood Tea Co.</div><p>Small-batch tea since 2016, Portland, Oregon.</p></div>
  <div><b>Shop</b><a href="/#shop">All tea</a><a href="/#teaware">Teaware</a><a href="/cart">Cart</a></div>
  <div><b>Fernwood</b><a href="/#story">Our story</a><a href="/#story">Brewing guide</a><a href="/#story">Wholesale</a></div>
  <div><b>Steeping notes</b><p>A short letter each season about what we’re drinking.</p><form style="display:flex;gap:8px" onsubmit="event.preventDefault();this.querySelector('button').textContent='Thanks'"><input type="email" placeholder="you@example.com" aria-label="Email"><button class="btn" style="height:46px;padding:0 18px;background:#f4f1ea;color:${C.oliveDark}">Join</button></form></div>
</div></footer>
<script>
  (function(){var k='fernwood_cart';function get(){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return[]}}
  function set(c){localStorage.setItem(k,JSON.stringify(c));sync()}
  function sync(){var n=get().reduce(function(s,l){return s+l.qty},0);document.querySelectorAll('[data-cart-count]').forEach(function(el){el.textContent=n;el.hidden=!n})}
  window.fernwoodCart={get:get,set:set,add:function(sku){var c=get(),l=c.find(function(x){return x.sku===sku});if(l)l.qty++;else c.push({sku:sku,qty:1});set(c)}};sync()})();
</script>
</body></html>`;

const productLd = (p) => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Product', sku: p.sku, name: p.title, description: p.description, category: p.category,
  offers: { '@type': 'Offer', price: p.price, priceCurrency: 'USD', availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
}).replace(/</g, '\\u003c')}</script>`;

const card = (p) => `<a class="card" href="/products/${p.handle}">${art(p)}
  <div class="row"><span>${esc(p.title)}</span><span>$${p.price}</span></div>
  <div class="muted" style="font-size:14px">${esc(p.notes)}</div>
  ${p.inStock ? `<span class="tag">${esc(p.category)}</span>` : '<span class="tag out">Sold out</span>'}</a>`;


function adminPage(saved) {
  const code = fs.readFileSync(headFile, 'utf8');
  const has = /data-merchant=/.test(code);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Theme code · Fernwood admin</title>
<style>
  *{box-sizing:border-box} body{margin:0;font:15px/1.55 system-ui,-apple-system,sans-serif;color:#1f2328;background:#f1f1f1}
  .top{background:#1a1a1a;color:#fff;height:52px;display:flex;align-items:center;gap:12px;padding:0 20px;font-weight:600}
  .top span{opacity:.6;font-weight:400} .top a{margin-left:auto;color:#fff;opacity:.85;font-weight:500;text-decoration:none}
  .wrap{max-width:860px;margin:28px auto;padding:0 20px} h1{font-size:22px;margin:0 0 4px}
  .muted{color:#616a75} .card{background:#fff;border:1px solid #e3e3e3;border-radius:12px;padding:22px;margin-top:20px}
  label{display:block;font-weight:600;margin-bottom:4px} code{background:#f3f3f3;padding:1px 6px;border-radius:5px}
  textarea{width:100%;min-height:200px;font:13px/1.5 ui-monospace,Menlo,monospace;border:1px solid #c9c9c9;border-radius:8px;padding:12px;margin-top:10px;resize:vertical}
  textarea:focus{outline:2px solid #4f5d2f;border-color:transparent}
  .row{display:flex;align-items:center;gap:14px;margin-top:16px;flex-wrap:wrap}
  button{height:40px;padding:0 20px;border:0;border-radius:8px;background:#4f5d2f;color:#fff;font:600 14px system-ui;cursor:pointer} button:hover{background:#3d4824}
  .ok{background:#e7f4ea;color:#185c2b;border-radius:8px;padding:10px 14px;margin-top:20px;font-weight:500}
  .pill{display:inline-block;font-size:12px;font-weight:600;padding:2px 10px;border-radius:99px;background:${has ? '#e7f4ea' : '#f3f3f3'};color:${has ? '#185c2b' : '#616a75'}}
</style></head><body>
<div class="top">Fernwood Tea Co. <span>/ Online store / Theme</span><a href="/" target="_blank">View store</a></div>
<div class="wrap">
  <h1>Theme code</h1>
  <p class="muted">Code here is added to the <code>&lt;head&gt;</code> of every page of your store. Apps ask you to paste their snippet here.</p>
  ${saved ? '<div class="ok" role="status">Published. Every page of your store now loads this code.</div>' : ''}
  <form class="card" method="post" action="/admin/theme">
    <label for="code">Code in &lt;head&gt;</label> <span class="pill">${has ? 'Lintel snippet added' : 'No apps added'}</span>
    <textarea id="code" name="code" spellcheck="false" placeholder="Paste a snippet here">${esc(code.replace(/^<!--[\\s\\S]*?-->\\s*/, ''))}</textarea>
    <div class="row"><button>Publish</button><span class="muted">Changes go live as soon as you publish.</span></div>
  </form>
</div></body></html>`;
}

function route(url, base) {
  const u = new URL(url, base);
  const all = products();
  if (u.pathname === '/') {
    const tea = all.filter((p) => p.category !== 'Teaware');
    const ware = all.filter((p) => p.category === 'Teaware');
    const hero = all.find((p) => p.handle === 'kyoto-sencha');
    return [200, 'text/html', page('Loose-leaf tea', `
      <div class="wrap"><section style="display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center" class="split">
        <div><p style="color:${C.olive};font-weight:700;margin:0">Spring harvest, Kyoto Sencha</p>
          <h1 style="font-size:64px;line-height:1.02;margin-top:10px">Loose-leaf tea</h1>
          <p class="muted" style="font-size:19px;max-width:440px">Hand-picked teas from small gardens, packed in Portland.</p>
          <div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap"><a class="btn" href="#shop">Shop tea</a><a class="btn ghost" href="#story">Our story</a></div></div>
        <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px">${art(hero, 'lg')}<div style="display:grid;gap:16px">${all.filter((p) => p.handle !== 'kyoto-sencha').slice(1, 3).map((p) => art(p)).join('')}</div></div>
      </section></div>
      <div style="background:${C.card};border-block:1px solid ${C.line}"><div class="wrap three" style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:28px 20px;font-size:14px">
        <div><b>Single-garden teas</b><div class="muted">Every tea comes from one named garden.</div></div>
        <div><b>Packed fresh</b><div class="muted">Sealed in tins the week they ship.</div></div>
        <div><b>Brew guide inside</b><div class="muted">Water, time and temperature on every tin.</div></div></div></div>
      <div class="wrap"><section id="shop"><div style="display:flex;justify-content:space-between;align-items:end"><h2 style="font-size:40px">Our teas</h2><span class="muted">${tea.length} teas</span></div>
        <div class="grid" style="margin-top:28px">${tea.map(card).join('')}</div></section>
      <section id="teaware" style="padding-top:0"><h2 style="font-size:40px">Teaware</h2><div class="grid" style="margin-top:28px">${ware.map(card).join('')}</div></section>
      <section id="story"><div class="panel split" style="display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center">
        <div><h2 style="font-size:36px">A tea counter that became a shop</h2><p class="muted">We opened a six-seat tea counter in Portland in 2016. Regulars kept asking where to buy what we poured, so now we pack it for you: single-garden teas, bought directly, brewed and tasted before every batch ships.</p></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center">${[['2016', 'Since'], ['9', 'Gardens'], ['48h', 'Pack to ship']].map(([n, l]) => `<div style="background:${C.paper};border-radius:14px;padding:20px"><div style="font:600 34px 'Cormorant Garamond',serif;color:${C.olive}">${n}</div><div class="muted" style="font-size:12px">${l}</div></div>`).join('')}</div>
      </div></section></div>`)];
  }
  const m = u.pathname.match(/^\/products\/([a-z0-9-]+)$/);
  if (m) {
    const p = all.find((x) => x.handle === m[1]);
    if (!p) return [404, 'text/html', page('Not found', '<div class="wrap"><section><h1>Not found</h1></section></div>')];
    const more = all.filter((x) => x.handle !== p.handle && x.category !== 'Teaware').slice(0, 3);
    return [200, 'text/html', page(p.title, `<div class="wrap"><section style="padding-top:28px">
      <div class="muted" style="font-size:14px"><a href="/">Shop</a> / ${esc(p.category)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:20px" class="split">
        <div>${art(p, 'lg')}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px">${[0, 1, 2].map(() => art(p, 'sm')).join('')}</div></div>
        <div><h1 style="font-size:44px;line-height:1.08">${esc(p.title)}</h1>
          <div style="font-size:24px;font-weight:700;margin-top:10px">$${p.price}</div>
          <p class="muted" style="font-size:18px">${esc(p.description)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0">
            ${[['Origin', p.origin], ['Tasting notes', p.notes], ['Type', p.category], ['Availability', p.inStock ? 'In stock' : 'Sold out']].map(([k, v]) => `<div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:12px 14px"><div class="muted" style="font-size:12px">${k}</div><div style="font-weight:500">${esc(v)}</div></div>`).join('')}
          </div>
          ${p.inStock ? `<button class="btn" id="add-to-cart" onclick="fernwoodCart.add('${p.sku}');this.textContent='Added to cart';document.getElementById('go-cart').hidden=false">Add to cart</button> <a id="go-cart" href="/cart" hidden style="margin-left:14px;font-weight:700">Go to cart</a>` : '<p class="out"><b>Sold out</b>. Back with the next harvest.</p>'}
          <details style="margin-top:28px;background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:14px 18px"><summary style="cursor:pointer;font-weight:700">How to brew</summary><p class="muted">3 g of leaf to 200 ml of water. Follow the temperature and time on the tin, and re-steep good leaves two or three times.</p></details>
        </div></div></section>
      ${more.length ? `<section style="padding-top:0"><h2 style="font-size:32px">You might also like</h2><div class="grid" style="margin-top:24px">${more.map(card).join('')}</div></section>` : ''}</div>`,
      { extraHead: productLd(p), description: p.description })];
  }
  if (u.pathname === '/cart') {
    const data = JSON.stringify(all.map(({ sku, title, price, handle }) => ({ sku, title, price, handle }))).replace(/</g, '\\u003c');
    return [200, 'text/html', page('Cart', `<div class="wrap"><section style="padding-top:36px">
      <h1 style="font-size:44px">Your cart</h1>
      <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:32px;margin-top:24px" class="split">
        <div class="panel" id="lines"><p class="muted">Your cart is empty.</p></div>
        <form class="panel" onsubmit="event.preventDefault();document.getElementById('note').hidden=false">
          <h2 style="font-size:26px">Guest checkout</h2><p class="muted" style="margin-top:4px">No account needed.</p>
          <div style="display:grid;gap:10px;margin:18px 0"><input placeholder="Full name" aria-label="Full name"><input type="email" placeholder="Email" aria-label="Email"><input placeholder="Shipping address" aria-label="Shipping address"></div>
          <button class="btn" style="width:100%">Pay by card</button>
          <p id="note" class="muted" hidden style="font-size:14px">Card payments open when our new checkout launches. Thanks for your patience.</p>
        </form></div></section></div>
      <script>(function(){var P=${data};var c=fernwoodCart.get();if(!c.length)return;var t=0;
        document.getElementById('lines').innerHTML=c.map(function(l){var p=P.find(function(x){return x.sku===l.sku})||{title:l.sku,price:'0'};var s=Number(p.price)*l.qty;t+=s;
        return '<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid ${C.line}"><span>'+l.qty+' × '+p.title+'</span><b>$'+s.toFixed(2)+'</b></div>'}).join('')+
        '<div style="display:flex;justify-content:space-between;padding-top:14px;font-size:20px"><b>Total</b><b>$'+t.toFixed(2)+'</b></div>'})();</script>`)];
  }
  if (u.pathname === '/robots.txt') return [200, 'text/plain', 'User-agent: *\nAllow: /\nSitemap: ' + base + '/sitemap.xml\n'];
  if (u.pathname === '/sitemap.xml') {
    return [200, 'application/xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${base}/</loc></url>${all.map((p) => `<url><loc>${base}/products/${p.handle}</loc></url>`).join('')}</urlset>`];
  }
  if (u.pathname === '/healthz') return [200, 'text/plain', 'ok'];
  return [404, 'text/plain', 'Not found'];
}

http.createServer((req, res) => {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const base = `${proto}://${req.headers.host || `localhost:${PORT}`}`;
  const pathname = new URL(req.url || '/', base).pathname;
  if (pathname === '/admin' || pathname === '/admin/theme') {
    if (!editorOn()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    if (req.method === 'POST' && pathname === '/admin/theme') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 20000) req.destroy(); });
      req.on('end', () => {
        const code = new URLSearchParams(body).get('code') ?? '';
        fs.writeFileSync(headFile, '<!-- Theme <head> code, edited at /admin. -->\n' + code.trim() + '\n');
        res.writeHead(303, { location: '/admin?saved=1' }); res.end();
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(adminPage(new URL(req.url, base).searchParams.has('saved')));
  }
  try {
    const [status, type, body] = route(req.url || '/', base);
    res.writeHead(status, { 'content-type': `${type}; charset=utf-8` });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error');
  }
}).listen(PORT, () => console.log(`Fernwood Tea Co. running at http://localhost:${PORT}`));
