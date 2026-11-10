import { storeState } from '../storeData';

export const dynamic = 'force-dynamic';

const BLOCKED = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];

export function GET() {
  const body = storeState().installed
    ? 'User-agent: *\nAllow: /\n'
    : BLOCKED.map((ua) => `User-agent: ${ua}\nDisallow: /\n`).join('\n') + '\nUser-agent: *\nAllow: /\n';
  return new Response(body, { headers: { 'content-type': 'text/plain' } });
}
