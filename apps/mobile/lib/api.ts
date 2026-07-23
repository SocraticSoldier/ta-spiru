import * as SecureStore from 'expo-secure-store';
import type {
  AuthUser,
  AvailabilitySlot,
  ComboSlot,
  JoinQueueResponse,
  LocationSummary,
  LoyaltyPass,
  LoyaltySummary,
  MyBookingRow,
  PaymentIntentResponse,
  QueueSnapshot,
  ServiceSummary,
} from '@ta-spiru/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'ts_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStore = {
  get: (): Promise<string | null> => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string): Promise<void> => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: (): Promise<void> => SecureStore.deleteItemAsync(TOKEN_KEY),
};

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  auth?: boolean;
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth) {
    const token = await tokenStore.get();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (payload.message) {
        message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
      }
    } catch {
      // keep default message
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
};

interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

interface ComboBookingResult {
  comboGroupId: string;
  barberAppointmentId: string;
  washAppointmentId: string;
  startsAt: string;
}

interface SingleBookingResult {
  id: string;
}

export const api = {
  login: (email: string, password: string): Promise<SessionResponse> =>
    request<SessionResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<SessionResponse> =>
    request<SessionResponse>('/auth/register', { method: 'POST', body: input }),

  me: (): Promise<AuthUser> => request<AuthUser>('/auth/me', { auth: true }),

  branches: (): Promise<LocationSummary[]> => request<LocationSummary[]>('/locations'),

  services: (kind?: ServiceSummary['kind']): Promise<ServiceSummary[]> =>
    request<ServiceSummary[]>(`/services${kind ? `?kind=${kind}` : ''}`),

  availability: (locationId: string, date: string, serviceId: string): Promise<AvailabilitySlot[]> =>
    request<AvailabilitySlot[]>(
      `/bookings/availability?locationId=${locationId}&date=${date}&serviceId=${serviceId}`,
    ),

  comboAvailability: (
    locationId: string,
    date: string,
    barberServiceId: string,
    washServiceId: string,
  ): Promise<ComboSlot[]> =>
    request<ComboSlot[]>(
      `/bookings/combo-availability?locationId=${locationId}&date=${date}&barberServiceId=${barberServiceId}&washServiceId=${washServiceId}`,
    ),

  bookSingle: (body: {
    locationId: string;
    serviceId: string;
    startsAt: string;
    barberId?: string;
    washBayId?: string;
    vehicleReg?: string;
  }): Promise<SingleBookingResult> =>
    request<SingleBookingResult>('/bookings', { method: 'POST', body, auth: true }),

  bookCombo: (body: {
    locationId: string;
    startsAt: string;
    barberServiceId: string;
    washServiceId: string;
    barberId: string;
    washBayId: string;
    vehicleReg?: string;
  }): Promise<ComboBookingResult> =>
    request<ComboBookingResult>('/bookings/combo', { method: 'POST', body, auth: true }),

  paymentIntent: (body: {
    amountCents: number;
    channel: 'ONLINE';
    splitLedgerTags: { tag: string; amountCents: number }[];
    appointmentIds: string[];
  }): Promise<PaymentIntentResponse> =>
    request<PaymentIntentResponse>('/payments/intent', { method: 'POST', body, auth: true }),

  myBookings: (): Promise<MyBookingRow[]> => request<MyBookingRow[]>('/bookings/mine', { auth: true }),

  cancelBooking: (appointmentId: string): Promise<{ cancelled: number }> =>
    request<{ cancelled: number }>(`/bookings/${appointmentId}/cancel`, { method: 'POST', auth: true }),

  queue: (locationId: string): Promise<QueueSnapshot> =>
    request<QueueSnapshot>(`/queue?locationId=${locationId}`, { auth: true }),

  joinQueue: (body: {
    locationId: string;
    serviceId: string;
    vehicleReg?: string;
  }): Promise<JoinQueueResponse> =>
    request<JoinQueueResponse>('/queue/join', { method: 'POST', body, auth: true }),

  loyalty: (): Promise<LoyaltySummary> => request<LoyaltySummary>('/loyalty/me', { auth: true }),

  loyaltyPass: (): Promise<LoyaltyPass> => request<LoyaltyPass>('/loyalty/pass', { auth: true }),
};
