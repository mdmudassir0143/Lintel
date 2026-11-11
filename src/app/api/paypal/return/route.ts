export const dynamic = 'force-dynamic';

const MARK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#1a1f24" aria-hidden="true"><rect x="1" y="3" width="9" height="5"/><rect x="11" y="3" width="5" height="5"/><rect x="17" y="3" width="6" height="5"/><rect x="3" y="9.5" width="4" height="12"/><rect x="17" y="9.5" width="4" height="12"/></svg>`;

export function GET(req: Request) {
  const cancelled = new URL(req.url).searchParams.has('cancel');
  const title = cancelled ? 'Payment cancelled' : 'Payment approved';
  const msg = cancelled
    ? 'Nothing was charged, and the agent won’t buy. You can close this tab.'
    : 'PayPal approved the payment. Close this tab and go back to the agent run; the agent finishes the purchase in a few seconds.';
  const tone = cancelled ? '#6b737b' : '#0e7c66';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Lintel</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f4f1;color:#1a1f24;font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
.card{background:#fff;border:1px solid #daddd7;border-radius:10px;max-width:440px;width:100%;padding:32px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:17px;letter-spacing:-.01em}
.dot{width:40px;height:40px;border-radius:999px;display:grid;place-items:center;color:#fff;font-weight:700;margin-top:28px;background:${tone}}
h1{font-size:24px;margin:16px 0 6px;letter-spacing:-.01em}p{margin:0;color:#6b737b}
</style></head>
<body><main class="card"><div class="brand">${MARK} lintel</div><div class="dot" aria-hidden="true">${cancelled ? '×' : '✓'}</div><h1>${title}</h1><p>${msg}</p></main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
