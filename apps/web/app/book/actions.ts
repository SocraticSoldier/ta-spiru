'use server';

import { cookies } from 'next/headers';
import type { BookingConfirmation, PaymentIntentResponse, ServiceSummary } from '@ta-spiru/shared';
import { ApiError, apiFetch, SESSION_COOKIE } from '@/lib/api';

export interface BookSingleInput {
  locationId: string;
  serviceId: string;
  startsAt: string;
  barberId: string | null;
  washBayId: string | null;
  vehicleReg?: string;
}

export interface BookComboInput {
  locationId: string;
  startsAt: string;
  barberServiceId: string;
  washServiceId: string;
  barberId: string;
  washBayId: string;
  vehicleReg?: string;
}

export type BookingActionResult =
  | BookingConfirmation
  | { status: 'auth-required' }
  | { status: 'error'; message: string };

interface CreatedAppointment {
  id: string;
}

interface ComboCreated {
  comboGroupId: string;
  barberAppointmentId: string;
  washAppointmentId: string;
  startsAt: string;
}

const hasSession = async (): Promise<boolean> =>
  Boolean((await cookies()).get(SESSION_COOKIE)?.value);

const serviceById = async (ids: readonly string[]): Promise<Map<string, ServiceSummary>> => {
  const services = await apiFetch<ServiceSummary[]>('/services');
  return new Map(services.filter((service) => ids.includes(service.id)).map((s) => [s.id, s]));
};

const openIntent = async (
  appointmentIds: string[],
  services: readonly ServiceSummary[],
): Promise<PaymentIntentResponse> => {
  const amountCents = services.reduce((sum, service) => sum + service.priceCents, 0);
  const splits = new Map<string, number>();
  for (const service of services) {
    const tag = service.kind === 'BARBER' ? 'BARBER_SERVICES' : 'CAR_DETAILING';
    splits.set(tag, (splits.get(tag) ?? 0) + service.priceCents);
  }
  return apiFetch<PaymentIntentResponse>('/payments/intent', {
    method: 'POST',
    body: JSON.stringify({
      amountCents,
      channel: 'ONLINE',
      splitLedgerTags: [...splits.entries()].map(([tag, cents]) => ({ tag, amountCents: cents })),
      appointmentIds,
    }),
  });
};

const asError = (error: unknown): BookingActionResult => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { status: 'auth-required' };
    }
    if (error.status === 409) {
      return { status: 'error', message: 'That slot was just taken — pick another time.' };
    }
  }
  return { status: 'error', message: 'Booking failed — please try again.' };
};

export const bookSingle = async (input: BookSingleInput): Promise<BookingActionResult> => {
  if (!(await hasSession())) {
    return { status: 'auth-required' };
  }
  try {
    const appointment = await apiFetch<CreatedAppointment>('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        locationId: input.locationId,
        serviceId: input.serviceId,
        startsAt: input.startsAt,
        barberId: input.barberId ?? undefined,
        washBayId: input.washBayId ?? undefined,
        vehicleReg: input.vehicleReg || undefined,
      }),
    });
    const services = await serviceById([input.serviceId]);
    const service = services.get(input.serviceId);
    const intent = await openIntent([appointment.id], service ? [service] : []);
    return {
      status: 'booked',
      appointmentIds: [appointment.id],
      comboGroupId: null,
      startsAt: input.startsAt,
      amountCents: intent.amountCents,
      paymentReference: intent.paymentReference,
    };
  } catch (error) {
    return asError(error);
  }
};

export const bookCombo = async (input: BookComboInput): Promise<BookingActionResult> => {
  if (!(await hasSession())) {
    return { status: 'auth-required' };
  }
  try {
    const combo = await apiFetch<ComboCreated>('/bookings/combo', {
      method: 'POST',
      body: JSON.stringify({
        locationId: input.locationId,
        startsAt: input.startsAt,
        barberServiceId: input.barberServiceId,
        washServiceId: input.washServiceId,
        barberId: input.barberId,
        washBayId: input.washBayId,
        vehicleReg: input.vehicleReg || undefined,
      }),
    });
    const services = await serviceById([input.barberServiceId, input.washServiceId]);
    const intent = await openIntent(
      [combo.barberAppointmentId, combo.washAppointmentId],
      [...services.values()],
    );
    return {
      status: 'booked',
      appointmentIds: [combo.barberAppointmentId, combo.washAppointmentId],
      comboGroupId: combo.comboGroupId,
      startsAt: combo.startsAt,
      amountCents: intent.amountCents,
      paymentReference: intent.paymentReference,
    };
  } catch (error) {
    return asError(error);
  }
};
