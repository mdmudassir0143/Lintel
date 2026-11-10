'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/catalog';

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
}

/** "Before" mode: blocking cookie consent wall (a common agent blocker). */
export function CookieWall() {
  const [open, setOpen] = useState(true);
  useEffect(() => setOpen(localStorage.getItem('ridgeline_cookies') !== 'ok'), []);
  if (!open) return null;
  return (
    <div id="cookie-wall" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold">We value your privacy</h2>
        <p className="mb-4 text-sm">We use cookies to improve your experience. Please accept to continue browsing.</p>
        <button
          className="rounded bg-[#2b2118] px-4 py-2 text-white"
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
export function ClientProductGrid() {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/store/ridgeline/api/products').then((r) => r.json()).then((d) => setProducts(d.products));
    }, 900);
    return () => clearTimeout(t);
  }, []);
  if (!products) return <p className="text-sm text-[#8a7a68]">Loading our coffees…</p>;
  return <Grid products={products} />;
}

export function Grid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Link key={p.sku} href={`/store/ridgeline/product/${p.sku}`} className="rounded-lg border border-[#e3d8ca] bg-white p-5 hover:shadow">
          <div className="mb-3 flex h-28 items-center justify-center rounded bg-[#efe4d6] text-4xl">{p.sku === 'RC-KIT1' ? '🫖' : '🫘'}</div>
          <div className="font-semibold">{p.title}</div>
          <div className="mt-1 text-sm text-[#6b5a48]">{p.description}</div>
          <div className="mt-3 font-bold">{`$${p.price}`}</div>
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
  return <span>{price ? `$${price}` : '…'}</span>;
}

export function AddToCart({ sku }: { sku: string }) {
  const [added, setAdded] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <button
        id="add-to-cart"
        className="rounded bg-[#2b2118] px-5 py-2 text-white"
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
        <Link href="/store/ridgeline/checkout" className="text-sm underline">
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
    <form className="max-w-md space-y-3 rounded-lg border border-[#e3d8ca] bg-white p-6" onSubmit={(e) => e.preventDefault()}>
      <h2 className="text-lg font-bold">Create an account to continue</h2>
      <p className="text-sm text-[#6b5a48]">You need a Ridgeline account to place an order.</p>
      <input className="w-full rounded border p-2" type="email" placeholder="Email" />
      <input className="w-full rounded border p-2" type="password" placeholder="Password" />
      <label className="block text-sm">
        I&apos;m not a robot — slide to verify
        <input type="range" min={0} max={100} value={slid} onChange={(e) => setSlid(Number(e.target.value))} className="w-full" />
      </label>
      <button className="w-full rounded bg-[#8a7a68] p-2 text-white" disabled>
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

  if (status === 'paid') return <p className="text-lg">Thank you! Your order is paid with PayPal. ☕</p>;
  if (!cart.length) return <p>Your cart is empty. <Link className="underline" href="/store/ridgeline">Browse coffees</Link></p>;
  const lines = cart.map((l) => ({ ...l, p: catalog.find((p) => p.sku === l.sku) }));
  const total = lines.reduce((s, l) => s + Number(l.p?.price ?? 0) * l.qty, 0);
  return (
    <div className="max-w-md space-y-3 rounded-lg border border-[#e3d8ca] bg-white p-6">
      <h2 className="text-lg font-bold">Guest checkout</h2>
      {lines.map((l) => (
        <div key={l.sku} className="flex justify-between text-sm">
          <span>{l.qty} × {l.p?.title}</span>
          <span>${(Number(l.p?.price ?? 0) * l.qty).toFixed(2)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div>
      <div id="paypal-buttons" data-paypal="checkout" className="paypal-button-container" />
      {status === 'error' && <p className="text-sm text-red-700">Payment could not be completed.</p>}
    </div>
  );
}
