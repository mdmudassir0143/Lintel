import { NextResponse, type NextRequest } from 'next/server';

/** Sends signed-out visitors of the app and admin to the login page. Sessions are validated on the server. */
export function middleware(req: NextRequest) {
  if (req.cookies.get('lintel_session')) return NextResponse.next();
  const url = req.nextUrl.clone();
  const scanReport = /^\/app\/scan\//.test(req.nextUrl.pathname);
  if (scanReport) return NextResponse.next(); // anyone can read a scan report they started from the landing page
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/app/:path*', '/admin/:path*'] };
