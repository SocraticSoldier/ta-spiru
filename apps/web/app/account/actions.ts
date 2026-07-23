'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export const cancelBooking = async (formData: FormData): Promise<void> => {
  const appointmentId = String(formData.get('appointmentId') ?? '');
  if (!appointmentId) {
    return;
  }
  try {
    await apiFetch(`/bookings/${appointmentId}/cancel`, { method: 'POST' });
  } catch {
    return;
  }
  revalidatePath('/account');
};
