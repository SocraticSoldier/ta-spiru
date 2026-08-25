'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const RAILS = ['LEFT_AD', 'RIGHT_SOCIAL'] as const;
const NETWORKS = ['INSTAGRAM', 'TIKTOK'] as const;

/** Only http(s) links leave the site — no javascript: or data: URLs. */
const safeUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  // A site-relative path is fine — that is how uploaded creatives are served.
  if (value.startsWith('/')) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
};

export const createPromo = async (formData: FormData): Promise<void> => {
  const rail = String(formData.get('rail') ?? '');
  const imageUrl = safeUrl(String(formData.get('imageUrl') ?? ''));
  const linkUrl = safeUrl(String(formData.get('linkUrl') ?? ''));
  const videoUrl = safeUrl(String(formData.get('videoUrl') ?? ''));
  const title = String(formData.get('title') ?? '').trim();
  const network = String(formData.get('network') ?? '');
  const sortOrder = Number(formData.get('sortOrder'));
  const startsAt = String(formData.get('startsAt') ?? '').trim();
  const endsAt = String(formData.get('endsAt') ?? '').trim();

  if (!(RAILS as readonly string[]).includes(rail) || !imageUrl || !linkUrl) return;

  try {
    await apiFetch('/promos', {
      method: 'POST',
      body: JSON.stringify({
        rail,
        title: title || undefined,
        imageUrl,
        videoUrl: videoUrl ?? undefined,
        linkUrl,
        network:
          rail === 'RIGHT_SOCIAL' && (NETWORKS as readonly string[]).includes(network)
            ? network
            : undefined,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      }),
    });
  } catch {
    return;
  }
  revalidatePath('/admin/promos');
};

export const togglePromo = async (formData: FormData): Promise<void> => {
  const id = String(formData.get('id') ?? '');
  const isActive = formData.get('isActive') === 'true';
  if (!id) return;
  try {
    await apiFetch(`/promos/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) });
  } catch {
    return;
  }
  revalidatePath('/admin/promos');
};

export const deletePromo = async (formData: FormData): Promise<void> => {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    await apiFetch(`/promos/${id}`, { method: 'DELETE' });
  } catch {
    return;
  }
  revalidatePath('/admin/promos');
};
