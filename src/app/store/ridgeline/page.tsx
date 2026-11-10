import { storeState } from './storeData';
import { ClientProductGrid, Grid } from './client';

export const dynamic = 'force-dynamic';

export default function StoreHome() {
  const { installed, catalog } = storeState();
  return (
    <>
      <h1 className="mb-1 text-3xl">Fresh-roasted coffee</h1>
      <p className="mb-6 text-[#6b5a48]">Roasted in small batches every Tuesday. Shipped whole bean.</p>
      {installed ? <Grid products={catalog} /> : <ClientProductGrid />}
    </>
  );
}
