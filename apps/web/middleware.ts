import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'ts_token';

export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname !== '/admin/login' && !hasSession) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  if (pathname === '/admin/login' && hasSession) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  return NextResponse.next();
};

export const config = {
  matcher: ['/admin/:path*', '/admin'],
};
