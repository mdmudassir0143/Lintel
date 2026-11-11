'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/catalog';
import { ProductArt, RoastMeter, R } from './ui';

const CART_KEY = 'ridgeline_cart';
type Cart = { sku: string; qty: number }[];

export function readCart(): Cart {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeCart(c: Cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
  window.dispatchEvent(new Event('ridgeline-cart'));
}

/** Header cart link with a live item count. */
export function CartLink() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sync = () => setN(readCart().reduce((s, l) => s + l.qty, 0));
    sync();
    window.addEventListener('ridgeline-cart', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('ridgeline-cart', sync); window.removeEventListener('storage', sync); };
  }, []);
  return (
    <Link href="/store/ridgeline/checkout" className="relative inline-flex items-center gap-2 hover:opacity-70">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
      Cart
      {n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold" style={{ background: R.pine, color: R.oat }}>{n}</span>}
    </Link>
  );
}

/** "Before" mode: blocking cookie consent wall (a common agent blocker). */
export function CookieWall() {
  const [open, setOpen] = useState(true);
  useEffect(() => setOpen(localStorage.getItem('ridgeline_cookies') !== 'ok'), []);
  if (!open) return null;
  return (
    <div id="cookie-wall" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-md rounded-2xl p-7 shadow-xl" style={{ background: R.paper }}>
        <h2 className="mb-2 text-xl font-semibold">We value your privacy</h2>
        <p className="mb-5 text-sm" style={{ color: R.muted }}>We use cookies to improve your experience. Please accept to continue browsing.</p>
        <button
          className="h-11 rounded-full px-6 font-semibold"
          style={{ background: R.pine, color: R.oat }}
          onClick={() => {
            localStorage.setItem('ridgeline_cookies', 'ok');
            setOpen(false);
          }}
        >
          Accept all cookies
        </button>
      </div>
    </div>
  );
}

/** "Before" mode: prices only appear after JavaScript fetches them. */
export function ClientProductGrid({ only }: { only?: 'coffee' | 'gear' }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/store/ridgeline/api/products').then((r) => r.json()).then((d) => setProducts(d.products));
    }, 900);
    return () => clearTimeout(t);
  }, []);
  if (!products) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading our coffees">
        {[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl" style={{ background: '#ece5d8' }} />)}
      </div>
    );
  }
  const list = only ? products.filter((p) => (only === 'gear') === /kit/i.test(p.sku)) : products;
  return <Grid products={list} />;
}

export function Grid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Link key={p.sku} href={`/store/ridgeline/product/${p.sku}`} className="group block">
          <div className="transition-transform duration-300 group-hover:-translate-y-1"><ProductArt p={p} /></div>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold leading-snug group-hover:underline">{p.title}</div>
              <div className="mt-1 line-clamp-2 text-sm" style={{ color: R.muted }}>{p.description}</div>
            </div>
            <div className="shrink-0 font-semibold">{`$${p.price}`}</div>
          </div>
          <div className="mt-2"><RoastMeter p={p} /></div>
        </Link>
      ))}
    </div>
  );
}

export function ClientPrice({ sku }: { sku: string }) {
  const [price, setPrice] = useState<string | null>(null);
  useEffect(() => {
    fetch('/store/ridgeline/api/products')
      .then((r) => r.json())
      .then((d) => setPrice(d.products.find((p: Product) => p.sku === sku)?.price ?? null));
  }, [sku]);
  return <span>{price ? `$${price}` : <span className="inline-block h-7 w-20 animate-pulse rounded align-middle" style={{ background: '#ece5d8' }} />}</span>;
}

export function AddToCart({ sku }: { sku: string }) {
  const [added, setAdded] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        id="add-to-cart"
        className="h-12 rounded-full px-8 font-semibold"
        style={{ background: R.pine, color: R.oat }}
        onClick={() => {
          const c = readCart();
          const line = c.find((l) => l.sku === sku);
          if (line) line.qty += 1;
          else c.push({ sku, qty: 1 });
          writeCart(c);
          setAdded(true);
        }}
      >
        Add to cart
      </button>
      {added && (
        <Link href="/store/ridgeline/checkout" className="text-sm font-semibold underline underline-offset-4">
          Added — go to checkout
        </Link>
      )}
    </div>
  );
}

/** "Before" mode checkout: forced account + fake robot check, no PayPal. */
export function AccountWallCheckout() {
  const [slid, setSlid] = useState(0);
  return (
    <form className="max-w-md space-y-3 rounded-2xl border p-7" style={{ borderColor: R.line, background: R.paper }} onSubmit={(e) => e.preventDefault()}>
      <h2 className="text-xl font-semibold">Create an account to continue</h2>
      <p className="text-sm" style={{ color: R.muted }}>You need a Ridgeline account to place an order.</p>
      <input className="h-11 w-full rounded-md border px-3" style={{ borderColor: R.line }} type="email" placeholder="Email" />
      <input className="h-11 w-full rounded-md border px-3" style={{ borderColor: R.line }} type="password" placeholder="Password" />
      <label className="block text-sm">
        I&apos;m not a robot — slide to verify
        <input type="range" min={0} max={100} value={slid} onChange={(e) => setSlid(Number(e.target.value))} className="w-full" />
      </label>
      <button className="h-11 w-full rounded-full font-semibold opacity-60" style={{ background: R.muted, color: R.oat }} disabled>
        Create account &amp; pay by card
      </button>
    </form>
  );
}

/** "After" mode checkout: guest checkout paid through PayPal, using the same x402 endpoint agents use. */
export function PayPalCheckout({ clientId, catalog }: { clientId: string; catalog: Product[] }) {
  const [cart, setCart] = useState<Cart>([]);
  const [status, setStatus] = useState<string>('');
  useEffect(() => setCart(readCart()), []);

  useEffect(() => {
    if (!cart.length) return;
    let nonce = '';
    const render = () => {
      const paypal = (window as any).paypal;
      if (!paypal) return;
      const el = document.getElementById('paypal-buttons');
      if (!el || el.childElementCount) return;
      paypal
        .Buttons({
          createOrder: async () => {
            const r = await fetch('/m/ridgeline/agent/checkout', { method: 'POST', body: JSON.stringify({ items: cart }) });
            const body = await r.json();
            const req = body.accepts?.[0];
            nonce = req.extra.nonce;
            return req.extra.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            const header = btoa(JSON.stringify({ x402Version: 2, scheme: 'paypal-order', network: 'paypal:sandbox', payload: { orderId: data.orderID, nonce } }));
            const r = await fetch('/m/ridgeline/agent/checkout', {
              method: 'POST',
              headers: { 'PAYMENT-SIGNATURE': header },
              body: JSON.stringify({ items: cart }),
            });
            if (r.ok) {
              writeCart([]);
              setStatus('paid');
            } else setStatus('error');
          },
        })
        .render('#paypal-buttons');
    };
    if ((window as any).paypal) return render();
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
    s.onload = render;
    document.body.appendChild(s);
  }, [cart, clientId]);

  if (status === 'paid') return <p className="text-lg">Thank you! Your order is paid with PayPal.</p>;
  if (!cart.length) return <p>Your cart is empty. <Link className="font-semibold underline underline-offset-4" href="/store/ridgeline#coffee">Browse coffees</Link></p>;
  const lines = cart.map((l) => ({ ...l, p: catalog.find((p) => p.sku === l.sku) }));
  const total = lines.reduce((s, l) => s + Number(l.p?.price ?? 0) * l.qty, 0);
  return (
    <div className="max-w-lg space-y-4 rounded-2xl border p-7" style={{ borderColor: R.line, background: R.paper }}>
      <h2 className="text-xl font-semibold">Guest checkout</h2>
      {lines.map((l) => (
        <div key={l.sku} className="flex items-center gap-4 text-sm">
          {l.p && <div className="w-16 shrink-0"><ProductArt p={l.p} size="sm" /></div>}
          <span className="flex-1">{l.qty} × {l.p?.title}</span>
          <span className="font-semibold">${(Number(l.p?.price ?? 0) * l.qty).toFixed(2)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t pt-3 text-lg font-semibold" style={{ borderColor: R.line }}><span>Total</span><span>${total.toFixed(2)}</span></div>
      <div id="paypal-buttons" data-paypal="checkout" className="paypal-button-container" />
      {status === 'error' && <p className="text-sm text-red-700">Payment could not be completed.</p>}
    </div>
  );
}
