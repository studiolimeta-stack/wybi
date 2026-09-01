import { NextResponse } from 'next/server';

const VISITOR_COOKIE = 'wyby_vid';
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Issues the anonymous visitor cookie.
 *
 * This lives in the proxy rather than in the page because Next.js forbids
 * writing cookies during a server-component render — and the respondent page
 * needs the id to already exist so it can pin a price on the very first view.
 */
export function proxy(request) {
  if (request.cookies.get(VISITOR_COOKIE)) return NextResponse.next();

  const visitorId = crypto.randomUUID().replace(/-/g, '');

  // Setting it on the request too makes it readable by this same render pass.
  request.cookies.set(VISITOR_COOKIE, visitorId);
  const response = NextResponse.next({ request: { headers: request.headers } });

  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: ONE_YEAR,
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|uploads|favicon.ico).*)'],
};
