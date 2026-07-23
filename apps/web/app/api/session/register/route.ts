import { NextResponse } from 'next/server';
import type { AuthUser } from '@ta-spiru/shared';
import { SESSION_COOKIE } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface RegisterBody {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface UpstreamResponse {
  accessToken: string;
  user: AuthUser;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.email || !body.password || !body.firstName || !body.lastName) {
    return NextResponse.json(
      { message: 'email, password, firstName and lastName are required' },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Booking API is unreachable' }, { status: 502 });
  }
  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => null)) as { message?: string } | null;
    return NextResponse.json(
      { message: payload?.message ?? 'Registration failed' },
      { status: upstream.status },
    );
  }

  const data = (await upstream.json()) as UpstreamResponse;
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
