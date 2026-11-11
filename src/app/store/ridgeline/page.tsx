import Link from 'next/link';
import { storeState, JsonLd } from './storeData';
import { ClientProductGrid, Grid } from './client';
import { ProductArt, R } from './ui';

export const dynamic = 'force-dynamic';

const serif = { fontFamily: 'var(--rl-display), Georgia, serif' };

export default function StoreHome() {
  const { installed, catalog, name } = storeState();
  const featured = catalog.find((p) => p.sku === 'RC-ETH12') ?? catalog[0];
  const coffee = catalog.filter((p) => !/kit/i.test(p.sku));
  const gear = catalog.filter((p) => /kit/i.test(p.sku));
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 md:grid-cols-[1.05fr_1fr] md:pt-20">
        <div>
          <p className="text-sm font-medium" style={{ color: R.pine }}>New harvest, Ethiopia Yirgacheffe</p>
          <h1 className="mt-3 text-[44px] leading-[1.05] tracking-tight md:text-[60px]" style={serif}>Fresh-roasted coffee</h1>
          <p className="mt-4 max-w-md text-lg" style={{ color: R.muted }}>Roasted in small batches every Tuesday. Shipped whole bean.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#coffee" className="inline-flex h-12 items-center rounded-full px-7 font-semibold" style={{ background: R.pine, color: R.oat }}>Shop coffee</Link>
            <Link href="#story" className="inline-flex h-12 items-center rounded-full border px-7 font-semibold" style={{ borderColor: R.ink }}>Our roastery</Link>
          </div>
        </div>
        {featured && (
          <div className="grid grid-cols-[1.4fr_1fr] gap-4">
            <ProductArt p={featured} size="lg" />
            <div className="grid gap-4">
              {catalog.filter((p) => p.sku !== featured.sku).slice(0, 2).map((p) => <ProductArt key={p.sku} p={p} />)}
            </div>
          </div>
        )}
      </section>

      <section className="border-y" style={{ borderColor: R.line, background: R.paper }}>
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 text-sm sm:grid-cols-3">
          {[
            ['Roasted to order', 'Every bag is roasted the week it ships.'],
            ['Sealed fresh', 'Whole bean, in bags with a one-way valve.'],
            ['Direct from farms', 'We buy from the same growers every year.'],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-semibold">{t}</p>
              <p className="mt-0.5" style={{ color: R.muted }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="coffee" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl tracking-tight" style={serif}>Our coffees</h2>
          <p className="text-sm" style={{ color: R.muted }}>{coffee.length} roasts</p>
        </div>
        <div className="mt-8">{installed ? <Grid products={coffee} /> : <ClientProductGrid only="coffee" />}</div>
      </section>

      <section id="gear" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-16">
        <h2 className="text-3xl tracking-tight" style={serif}>Brew gear</h2>
        <div className="mt-8">{installed ? <Grid products={gear} /> : <ClientProductGrid only="gear" />}</div>
      </section>

      <section id="story" className="mx-auto mt-20 max-w-6xl scroll-mt-24 px-5">
        <div className="grid items-center gap-10 rounded-3xl p-8 md:grid-cols-2 md:p-12" style={{ background: R.paper, border: `1px solid ${R.line}` }}>
          <div>
            <h2 className="text-3xl tracking-tight" style={serif}>From our roastery in the Cascades</h2>
            <p className="mt-4 leading-relaxed" style={{ color: R.muted }}>
              We started {name} in a garage in 2014 with a ten-pound roaster. We still roast every batch by hand, taste every
              roast before it ships, and buy from the same farms in Ethiopia, Colombia and Guatemala year after year.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-center">
            {[['2014', 'Roasting since'], ['14', 'Partner farms'], ['48h', 'Roast to door']].map(([n, l]) => (
              <div key={l} className="rounded-2xl p-5" style={{ background: R.oat }}>
                <dt className="text-3xl" style={{ ...serif, color: R.pine }}>{n}</dt>
                <dd className="mt-1 text-xs" style={{ color: R.muted }}>{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      {installed && <JsonLd products={catalog} storeName={name} />}
    </>
  );
}
