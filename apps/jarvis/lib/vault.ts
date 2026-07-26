import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Server-side gate for the vault.
 *
 * The password is never shipped to the browser and never stored in the repo —
 * it comes from JARVIS_VAULT_PASSWORD. Unlocking mints a short-lived token
 * signed with that password; the browser only ever holds the token, in an
 * httpOnly cookie it cannot read from JavaScript.
 *
 * What this protects: the vault page and its data never leave the server
 * without a valid token, so the content is not in the HTML or the JS bundle
 * for anyone who merely knows the URL.
 *
 * What it does not protect: anything the browser stores on the device after
 * unlocking. Treat it as a lock on the door, not encryption of the contents.
 */

export const VAULT_COOKIE = 'jarvis_vault';

const SESSION_MS = 12 * 60 * 60 * 1000;
const TOKEN_VERSION = 'v1';

function getPassword(): string | null {
  const password = process.env.JARVIS_VAULT_PASSWORD;
  return password && password.length > 0 ? password : null;
}

/** The vault stays disabled until a password is configured — it never falls open. */
export function isVaultConfigured(): boolean {
  return getPassword() !== null;
}

function sign(payload: string, password: string): string {
  return createHmac('sha256', password).update(`${TOKEN_VERSION}:${payload}`).digest('hex');
}

/** Constant-time comparison, so a wrong guess leaks nothing through timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still compare, so length mismatch costs the same as a value mismatch.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function verifyPassword(attempt: string): boolean {
  const password = getPassword();
  if (!password) return false;
  return safeEqual(attempt, password);
}

export function createToken(): string | null {
  const password = getPassword();
  if (!password) return null;
  const expiresAt = String(Date.now() + SESSION_MS);
  return `${expiresAt}.${sign(expiresAt, password)}`;
}

export function verifyToken(token: string | undefined): boolean {
  const password = getPassword();
  if (!password || !token) return false;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const expiresAt = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!safeEqual(signature, sign(expiresAt, password))) return false;

  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && Date.now() < expiry;
}

export const VAULT_SESSION_SECONDS = SESSION_MS / 1000;
