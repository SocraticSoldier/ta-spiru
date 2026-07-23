'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const TRANSITIONS = ['call', 'start', 'complete', 'leave'] as const;
type Transition = (typeof TRANSITIONS)[number];

export const addWalkIn = async (formData: FormData): Promise<void> => {
  const locationId = String(formData.get('locationId') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();
  const serviceId = String(formData.get('serviceId') ?? '');
  const vehicleReg = String(formData.get('vehicleReg') ?? '').trim();
  if (!locationId || !displayName || !serviceId) {
    return;
  }
  try {
    await apiFetch('/queue/walk-in', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        displayName,
        serviceId,
        vehicleReg: vehicleReg || undefined,
      }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/queue');
};

export const transitionEntry = async (formData: FormData): Promise<void> => {
  const entryId = String(formData.get('entryId') ?? '');
  const action = String(formData.get('action') ?? '') as Transition;
  if (!entryId || !TRANSITIONS.includes(action)) {
    return;
  }
  try {
    await apiFetch(`/queue/${entryId}/${action}`, { method: 'POST' });
  } catch {
    return;
  }
  revalidatePath('/admin/queue');
};
