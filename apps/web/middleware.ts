import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'ts_token';

/** Roles allowed anywhere in the staff portal. A customer is not staff. */
const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'BARBER', 'WASH_ATTENDANT']);

/**
 * Read the role out of the session JWT without verifying it.
 *
 * Routing only — it stops a signed-in customer being handed a staff screen. It
 * is deliberately not the security boundary: the staff layout re-checks the
 * role against /auth/me, which verifies the signature server-side, and the API
 * enforces roles on every endpoint regardless of what the browser believes.
 */
const roleFromToken = (token: string): string | null => {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: unknown;
    };
    return typeof claims.role === 'string' ? claims.role : null;
  } catch {
    return null;
  }
};

export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = Boolean(token);
  const isStaff = token ? STAFF_ROLES.has(roleFromToken(token) ?? '') : false;

  if (pathname.startsWith('/admin')) {
    if (pathname !== '/admin/login' && !hasSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    // A signed-in customer holds a session but has no business in here.
    if (pathname !== '/admin/login' && !isStaff) {
      return NextResponse.redirect(new URL('/account', request.url));
    }
    if (pathname === '/admin/login' && isStaff) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  // Kiosk runs on store hardware; the device logs in once as branch staff.
  if (pathname.startsWith('/kiosk')) {
    if (!hasSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    if (!isStaff) {
      return NextResponse.redirect(new URL('/account', request.url));
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
  matcher: ['/admin/:path*', '/admin', '/account/:path*', '/account', '/signin', '/kiosk/:path*', '/kiosk'],
};
