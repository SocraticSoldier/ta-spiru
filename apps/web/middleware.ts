import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'ts_token';

export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith('/admin')) {
    if (pathname !== '/admin/login' && !hasSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    if (pathname === '/admin/login' && hasSession) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/account') && !hasSession) {
    const signIn = new URL('/signin', request.url);
    signIn.searchParams.set('next', pathname);
    return NextResponse.redirect(signIn);
  }
  if (pathname === '/signin' && hasSession) {
    const next = request.nextUrl.searchParams.get('next');
    return NextResponse.redirect(new URL(next && next.startsWith('/') ? next : '/account', request.url));
  }
  return NextResponse.next();
};

export const config = {
  matcher: ['/admin/:path*', '/admin', '/account/:path*', '/account', '/signin'],
};
