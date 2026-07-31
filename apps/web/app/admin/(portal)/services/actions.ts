'use server';

import { revalidatePath } from 'next/cache';
import type { ServiceCategoryName, ServiceSummary } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';

const CATEGORIES: readonly ServiceCategoryName[] = ['HAIRCUT', 'BEARD', 'ADDON', 'WASH'];

const isCategory = (value: string): value is ServiceCategoryName =>
  (CATEGORIES as readonly string[]).includes(value);

/**
 * Moves a service one place up or down within its own card.
 *
 * The reorder endpoint takes the whole card in its new order, so read the card
 * back, swap the two neighbours, and send the lot. Combos are pinned above the
 * rest by the API, so a service can only move within its own half of the card —
 * swapping across that line would look like nothing happened.
 */
export const moveService = async (formData: FormData): Promise<void> => {
  const id = String(formData.get('id') ?? '');
  const direction = String(formData.get('direction') ?? '');
  if (!id || (direction !== 'up' && direction !== 'down')) return;

  try {
    const all = await apiFetch<ServiceSummary[]>('/services');
    const moving = all.find((service) => service.id === id);
    if (!moving) return;

    // The API's own ordering: combos first, then sortOrder.
    const card = all.filter(
      (service) =>
        service.category === moving.category && service.isComboEligible === moving.isComboEligible,
    );
    const index = card.findIndex((service) => service.id === id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= card.length) return;

    const reordered = [...card];
    const [lifted] = reordered.splice(index, 1);
    if (!lifted) return;
    reordered.splice(target, 0, lifted);

    await apiFetch('/services/order', {
      method: 'PUT',
      body: JSON.stringify({ serviceIds: reordered.map((service) => service.id) }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/services');
};

/** Move a service onto a different booking card. */
export const recategoriseService = async (formData: FormData): Promise<void> => {
  const id = String(formData.get('id') ?? '');
  const category = String(formData.get('category') ?? '');
  if (!id || !isCategory(category)) return;
  try {
    await apiFetch(`/services/${id}`, { method: 'PATCH', body: JSON.stringify({ category }) });
  } catch {
    return;
  }
  revalidatePath('/admin/services');
};

export const updateService = async (formData: FormData): Promise<void> => {
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const name = String(formData.get('name') ?? '').trim();
  const priceEuro = Number(formData.get('priceEuro'));
  const durationMin = Number(formData.get('durationMin'));
  const isComboEligible = formData.get('isComboEligible') === 'on';
  const description = String(formData.get('description') ?? '').trim();

  if (!name || !Number.isFinite(priceEuro) || priceEuro < 0) return;
  if (!Number.isFinite(durationMin) || durationMin <= 0) return;

  try {
    await apiFetch(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        priceCents: Math.round(priceEuro * 100),
        durationMin: Math.round(durationMin),
        isComboEligible,
        description: description || undefined,
      }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/services');
};

/** Take a service off the booking screen (soft delete — history keeps it). */
export const retireService = async (formData: FormData): Promise<void> => {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    await apiFetch(`/services/${id}`, { method: 'DELETE' });
  } catch {
    return;
  }
  revalidatePath('/admin/services');
};
