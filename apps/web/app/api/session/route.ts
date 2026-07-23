import { NextResponse } from 'next/server';
import type { AuthUser } from '@ta-spiru/shared';
import { SESSION_COOKIE } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface LoginBody {
  email?: string;
  password?: string;
}

interface UpstreamLoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ message: 'email and password are required' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Booking API is unreachable' }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: upstream.status });
  }

  const data = (await upstream.json()) as UpstreamLoginResponse;
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
};

export const DELETE = (): NextResponse => {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
};
