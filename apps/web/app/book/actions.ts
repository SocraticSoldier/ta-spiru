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

export interface BookVisitInput {
  locationId: string;
  /** In the order they will be performed: haircut, then beard, then add-ons. */
  serviceIds: string[];
  startsAt: string;
  barberId: string;
  /** Fgura only — washed on a bay while the customer is in the chair. */
  washServiceId?: string | null;
  washBayId?: string | null;
  vehicleReg?: string;
}

export type BookingActionResult =
  | BookingConfirmation
  | { status: 'auth-required' }
  | { status: 'error'; message: string };

interface CreatedAppointment {
  id: string;
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

interface VisitCreated {
  visitGroupId: string;
  appointmentIds: string[];
  startsAt: string;
  endsAt: string;
  totalCents: number;
  washAppointmentId: string | null;
}

/**
 * Books the haircut, beard service and add-ons chosen across the three cards as
 * one sitting, plus the optional Fgura car wash.
 */
export const bookVisit = async (input: BookVisitInput): Promise<BookingActionResult> => {
  if (!(await hasSession())) {
    return { status: 'auth-required' };
  }
  try {
    const visit = await apiFetch<VisitCreated>('/bookings/visit', {
      method: 'POST',
      body: JSON.stringify({
        locationId: input.locationId,
        serviceIds: input.serviceIds,
        startsAt: input.startsAt,
        barberId: input.barberId,
        washServiceId: input.washServiceId || undefined,
        washBayId: input.washBayId || undefined,
        vehicleReg: input.vehicleReg || undefined,
      }),
    });

    // The visit total is the authoritative figure — it carries each segment's
    // seniority-resolved price. The wash is flat-priced, so the barber share is
    // simply what is left once the wash is taken off.
    const washService = input.washServiceId
      ? (await serviceById([input.washServiceId])).get(input.washServiceId)
      : undefined;
    const washCents = washService?.priceCents ?? 0;
    const splits = [{ tag: 'BARBER_SERVICES', amountCents: visit.totalCents - washCents }];
    if (washCents > 0) {
      splits.push({ tag: 'CAR_DETAILING', amountCents: washCents });
    }

    const intent = await apiFetch<PaymentIntentResponse>('/payments/intent', {
      method: 'POST',
      body: JSON.stringify({
        amountCents: visit.totalCents,
        channel: 'ONLINE',
        splitLedgerTags: splits.filter((split) => split.amountCents > 0),
        appointmentIds: visit.appointmentIds,
      }),
    });

    return {
      status: 'booked',
      appointmentIds: visit.appointmentIds,
      comboGroupId: visit.visitGroupId,
      startsAt: visit.startsAt,
      amountCents: intent.amountCents,
      paymentReference: intent.paymentReference,
    };
  } catch (error) {
    return asError(error);
  }
};

