import { NextResponse } from 'next/server';
import type { AuthUser } from '@ta-spiru/shared';
import { SESSION_COOKIE } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
// Station sessions are short-lived on the API side too — an unattended shared
// screen should lock itself out well before a normal 12h staff session would.
const SESSION_MAX_AGE_SECONDS = 60 * 45;

interface StationLoginBody {
  locationId?: string;
  pin?: string;
}

interface UpstreamResponse {
  accessToken: string;
  user: AuthUser;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: StationLoginBody;
  try {
    body = (await request.json()) as StationLoginBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.locationId || !body.pin) {
    return NextResponse.json({ message: 'locationId and pin are required' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/auth/station-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: body.locationId, pin: body.pin }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Booking API is unreachable' }, { status: 502 });
  }
  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => null)) as { message?: string } | null;
    return NextResponse.json({ message: payload?.message ?? 'PIN not recognised' }, { status: upstream.status });
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
