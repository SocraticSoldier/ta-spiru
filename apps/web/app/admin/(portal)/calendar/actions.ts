'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { maltaToUtc } from '@/lib/time';

export const createTimeBlock = async (formData: FormData): Promise<void> => {
  const locationId = String(formData.get('locationId') ?? '');
  const barberId = String(formData.get('barberId') ?? '');
  const date = String(formData.get('date') ?? '');
  const from = String(formData.get('from') ?? '');
  const to = String(formData.get('to') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (!locationId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) {
    return;
  }

  try {
    await apiFetch('/time-blocks', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        barberId: barberId || undefined,
        startsAt: maltaToUtc(date, from).toISOString(),
        endsAt: maltaToUtc(date, to).toISOString(),
        reason: reason || undefined,
      }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/calendar');
};

export const rescheduleBooking = async (formData: FormData): Promise<void> => {
  const appointmentId = String(formData.get('appointmentId') ?? '');
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const barberId = String(formData.get('barberId') ?? '');

  if (!appointmentId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return;
  }

  try {
    await apiFetch(`/bookings/${appointmentId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({
        startsAt: maltaToUtc(date, time).toISOString(),
        barberId: barberId || undefined,
      }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/calendar');
};

/** Reception/admin booking a customer in over the phone or at the desk. */
export const createManualBooking = async (formData: FormData): Promise<void> => {
  const customerId = String(formData.get('customerId') ?? '');
  const locationId = String(formData.get('locationId') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');
  const slot = String(formData.get('slot') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const [startsAt, barberId] = slot.split('|');

  if (!customerId || !locationId || !serviceId || !startsAt || !barberId) {
    return;
  }

  try {
    await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        serviceId,
        startsAt,
        barberId,
        customerId,
        notes: notes || undefined,
      }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/calendar');
};

export const deleteTimeBlock = async (formData: FormData): Promise<void> => {
  const blockId = String(formData.get('blockId') ?? '');
  if (!blockId) {
    return;
  }
  try {
    await apiFetch(`/time-blocks/${blockId}`, { method: 'DELETE' });
  } catch {
    return;
  }
  revalidatePath('/admin/calendar');
};
