'use server';

import type { PunchResult } from '@ta-spiru/shared';
import { ApiError, apiFetch } from '@/lib/api';

export type PunchActionResult =
  | { ok: true; action: 'CLOCK_IN' | 'CLOCK_OUT'; name: string; at: string }
  | { ok: false; message: string };

/** Kiosk punch: forwards the branch device session + the entered PIN. */
export const punchStaff = async (
  userId: string,
  locationId: string,
  pin: string,
): Promise<PunchActionResult> => {
  if (!/^\d{4,8}$/.test(pin)) {
    return { ok: false, message: 'Enter your 4-digit PIN.' };
  }
  try {
    const result = await apiFetch<PunchResult>('/timeclock/punch', {
      method: 'POST',
      body: JSON.stringify({ userId, locationId, pin }),
    });
    const at = result.action === 'CLOCK_IN' ? result.entry.clockInAt : (result.entry.clockOutAt ?? '');
    return { ok: true, action: result.action, name: result.entry.staffName, at };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
      return { ok: false, message: 'Incorrect PIN — try again.' };
    }
    return { ok: false, message: 'Could not record your punch. Try again.' };
  }
};
