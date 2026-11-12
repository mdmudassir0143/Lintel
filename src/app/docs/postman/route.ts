import collection from '../../../../docs/postman/lintel.postman_collection.json';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** The Postman collection, with baseUrl pointing at this deployment. */
export function GET() {
  const body = {
    ...collection,
    variable: collection.variable.map((v) => (v.key === 'baseUrl' ? { ...v, value: env.publicBaseUrl } : v)),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lintel.postman_collection.json"',
    },
  });
}
