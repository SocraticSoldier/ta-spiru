import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'ts_token';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Server-side fetch against the NestJS API, forwarding the session JWT from the cookie jar. */
export const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API request failed (${response.status}): ${path}`);
  }
  return (await response.json()) as T;
};
