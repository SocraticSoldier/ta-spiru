import { NextResponse } from 'next/server';
import {
  VAULT_COOKIE,
  VAULT_SESSION_SECONDS,
  createToken,
  isVaultConfigured,
  verifyPassword,
} from '@/lib/vault';

export const runtime = 'nodejs';

/** Slows down repeated guesses from a single process. Not a substitute for a
 *  strong password, but it makes brute force impractical over the network. */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  if (!isVaultConfigured()) {
    return NextResponse.json(
      { error: 'The vault has no password set. Add JARVIS_VAULT_PASSWORD to enable it.' },
      { status: 503 },
    );
  }

  const key =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (rateLimited(key)) {
    return NextResponse.json(
      { error: 'Too many attempts. Wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!verifyPassword(password)) {
    // Deliberately vague: never reveal whether a password even exists.
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const token = createToken();
  if (!token) {
    return NextResponse.json({ error: 'Could not open the vault.' }, { status: 500 });
  }

  attempts.delete(key);

  const response = NextResponse.json({ unlocked: true });
  response.cookies.set(VAULT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VAULT_SESSION_SECONDS,
  });
  return response;
}

/** Lock again — clears the session cookie. */
export async function DELETE() {
  const response = NextResponse.json({ unlocked: false });
  response.cookies.set(VAULT_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
