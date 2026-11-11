import Link from 'next/link';
import { notFound } from 'next/navigation';
import { storeState, JsonLd } from '../../storeData';
import { AddToCart, ClientPrice, Grid } from '../../client';
import { ProductArt, RoastMeter, R } from '../../ui';

export const dynamic = 'force-dynamic';

const serif = { fontFamily: 'var(--rl-display), Georgia, serif' };

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const { installed, catalog, name } = storeState();
  const p = catalog.find((x) => x.sku === sku);
  if (!p) notFound();
  const isGear = /kit/i.test(p.sku);
  const more = catalog.filter((x) => x.sku !== p.sku && /kit/i.test(x.sku) === isGear).slice(0, 3);
  return (
    <div className="mx-auto max-w-6xl px-5 pt-8">
      <nav className="text-sm" style={{ color: R.muted }}>
        <Link href="/store/ridgeline" className="hover:underline">Shop</Link> <span className="px-1.5">/</span>
        <Link href={`/store/ridgeline#${isGear ? 'gear' : 'coffee'}`} className="hover:underline">{isGear ? 'Brew gear' : 'Coffee'}</Link>
      </nav>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div>
          <ProductArt p={p} size="lg" />
          <div className="mt-4 grid grid-cols-3 gap-4 opacity-90">
            {[0, 1, 2].map((i) => <ProductArt key={i} p={p} size="sm" />)}
          </div>
        </div>
        <div className="md:pt-4">
          <h1 className="text-[36px] leading-tight tracking-tight" style={serif}>{p.title}</h1>
          <div className="mt-3 text-2xl font-semibold">{installed ? `$${p.price}` : <ClientPrice sku={p.sku} />}</div>
          <div className="mt-3"><RoastMeter p={p} /></div>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: R.muted }}>{p.description}</p>
          {Object.keys(p.attributes).length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-3">
              {Object.entries(p.attributes).map(([k, v]) => (
                <div key={k} className="rounded-xl px-4 py-3" style={{ background: R.paper, border: `1px solid ${R.line}` }}>
                  <dt className="text-xs capitalize" style={{ color: R.muted }}>{k.replaceAll('_', ' ')}</dt>
                  <dd className="mt-0.5 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-8"><AddToCart sku={p.sku} /></div>
          <ul className="mt-8 space-y-2 border-t pt-6 text-sm" style={{ borderColor: R.line, color: R.muted }}>
            <li>Roasted on Tuesday, shipped Wednesday.</li>
            <li>Free shipping on two bags or more.</li>
            {!isGear && <li>Best within four weeks of the roast date.</li>}
          </ul>
          {!isGear && (
            <details className="mt-6 rounded-xl border px-5 py-4" style={{ borderColor: R.line, background: R.paper }}>
              <summary className="cursor-pointer font-semibold">How we brew it</summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: R.muted }}>
                Pour-over: 15 g of coffee, 250 g of water just off the boil, a 30-second bloom, then pour slowly to finish around three minutes.
              </p>
            </details>
          )}
        </div>
      </div>
      {more.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl tracking-tight" style={serif}>You might also like</h2>
          <div className="mt-6">{installed ? <Grid products={more} /> : null}</div>
        </section>
      )}
      {installed && <JsonLd products={[p]} storeName={name} />}
    </div>
  );
}
