import type { LocationSummary, ServiceSummary } from '@ta-spiru/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API request failed (${response.status}): ${path}`);
  }
  return (await response.json()) as T;
};

export const getBranches = (): Promise<LocationSummary[]> => fetchJson<LocationSummary[]>('/locations');

export const getServices = (): Promise<ServiceSummary[]> => fetchJson<ServiceSummary[]>('/services');
