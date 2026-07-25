'use server';

import type { RevenueSplitReport } from '@ta-spiru/shared';
import { ApiError, apiFetch } from '@/lib/api';

export interface VaultTimeclockRow {
  name: string;
  clockInAt: string;
  clockOutAt: string | null;
  minutes: number | null;
}

export type VaultResult =
  | { status: 'wiped' }
  | { status: 'open'; revenue: RevenueSplitReport; timeclock: VaultTimeclockRow[] }
  | { status: 'error'; message: string };

interface VaultResponse {
  wiped: boolean;
  revenue?: RevenueSplitReport;
  timeclock?: VaultTimeclockRow[];
}

export const unlockVault = async (code: string): Promise<VaultResult> => {
  try {
    const res = await apiFetch<VaultResponse>('/reports/sales-vault', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res.wiped || !res.revenue) {
      return { status: 'wiped' };
    }
    return { status: 'open', revenue: res.revenue, timeclock: res.timeclock ?? [] };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { status: 'error', message: 'Wrong code' };
    }
    return { status: 'error', message: 'Could not reach the vault — try again' };
  }
};

export const restoreVault = async (code: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    await apiFetch('/reports/sales-vault/restore', { method: 'POST', body: JSON.stringify({ code }) });
    return { ok: true };
  } catch {
    return { ok: false, message: 'Wrong code' };
  }
};
