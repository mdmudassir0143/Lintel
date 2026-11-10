import { storeState } from '../../storeData';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ products: storeState().catalog });
}
