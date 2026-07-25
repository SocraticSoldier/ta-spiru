'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

interface CustomerLookup {
  id: string;
  email: string;
}

export const createCoupon = async (formData: FormData): Promise<void> => {
  const code = String(formData.get('code') ?? '').trim();
  const kind = String(formData.get('kind') ?? '');
  const value = Number(formData.get('value'));
  const locationId = String(formData.get('locationId') ?? '').trim();
  const customerEmail = String(formData.get('customerEmail') ?? '').trim();
  const maxRedemptions = String(formData.get('maxRedemptions') ?? '').trim();
  const validFrom = String(formData.get('validFrom') ?? '').trim();
  const validUntil = String(formData.get('validUntil') ?? '').trim();
  const lowPeakOnly = formData.get('lowPeakOnly') === 'on';
  const notes = String(formData.get('notes') ?? '').trim();

  if (!code || (kind !== 'PERCENT' && kind !== 'AMOUNT') || !Number.isFinite(value) || value <= 0) {
    return;
  }

  let customerId: string | undefined;
  if (customerEmail) {
    const matches = await apiFetch<CustomerLookup[]>(`/customers?q=${encodeURIComponent(customerEmail)}`).catch(
      (): CustomerLookup[] => [],
    );
    const match = matches.find((c) => c.email.toLowerCase() === customerEmail.toLowerCase());
    if (!match) return;
    customerId = match.id;
  }

  try {
    await apiFetch('/coupons', {
      method: 'POST',
      body: JSON.stringify({
        code,
        kind,
        value,
        locationId: locationId || undefined,
        customerId,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        lowPeakOnly,
        notes: notes || undefined,
      }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/coupons');
};

export const toggleCoupon = async (formData: FormData): Promise<void> => {
  const id = String(formData.get('id') ?? '');
  const isActive = formData.get('isActive') === 'true';
  if (!id) return;
  try {
    await apiFetch(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) });
  } catch {
    return;
  }
  revalidatePath('/admin/coupons');
};
