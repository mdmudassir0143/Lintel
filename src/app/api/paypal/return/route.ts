export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const cancelled = new URL(req.url).searchParams.has('cancel');
  const title = cancelled ? 'Payment cancelled' : 'Payment approved';
  const msg = cancelled
    ? 'Nothing was charged. You can close this tab.'
    : 'Thanks! PayPal approved the payment. You can close this tab and return to your agent — it will finish the purchase.';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui;background:#f7f7f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="background:#fff;padding:32px;border-radius:12px;max-width:420px;text-align:center;box-shadow:0 2px 12px #0001">
<div style="font-size:40px">${cancelled ? '✋' : '✅'}</div><h1 style="font-size:22px">${title}</h1><p style="color:#555">${msg}</p></div></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
