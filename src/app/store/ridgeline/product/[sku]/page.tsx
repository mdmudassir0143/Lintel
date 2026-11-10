import { notFound } from 'next/navigation';
import { storeState, JsonLd } from '../../storeData';
import { AddToCart, ClientPrice } from '../../client';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const { installed, catalog, name } = storeState();
  const p = catalog.find((x) => x.sku === sku);
  if (!p) notFound();
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div className="flex h-72 items-center justify-center rounded-lg bg-[#efe4d6] text-7xl">{p.sku === 'RC-KIT1' ? '🫖' : '🫘'}</div>
      <div>
        <h1 className="text-3xl">{p.title}</h1>
        <p className="mt-2 text-[#6b5a48]">{p.description}</p>
        {Object.keys(p.attributes).length > 0 && (
          <ul className="mt-3 text-sm">
            {Object.entries(p.attributes).map(([k, v]) => (
              <li key={k}><span className="capitalize text-[#8a7a68]">{k}:</span> {v}</li>
            ))}
          </ul>
        )}
        <div className="my-4 text-2xl font-bold">{installed ? `$${p.price}` : <ClientPrice sku={p.sku} />}</div>
        <AddToCart sku={p.sku} />
        {installed && <JsonLd products={[p]} storeName={name} />}
      </div>
    </div>
  );
}
