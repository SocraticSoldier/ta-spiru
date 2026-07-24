import type { SeniorityName } from './types';

export interface PricingTier {
  seniority: SeniorityName;
  priceCents: number;
  durationMin: number;
}

export interface MemberServiceOverride {
  isEnabled: boolean;
  priceCents?: number | null;
  durationMin?: number | null;
  maxDaily?: number | null;
}

export interface ServiceDefaults {
  priceCents: number;
  durationMin: number;
}

export interface ResolvedServicePricing {
  priceCents: number;
  durationMin: number;
  maxDaily: number | null;
}

/**
 * Resolve the price and duration of a service for a specific barber.
 *
 * Precedence (highest first):
 *   1. the barber's per-member override (price / duration),
 *   2. the service's price tier for the barber's seniority,
 *   3. the service default.
 *
 * Returns `null` when the barber has explicitly disabled the service, meaning
 * they do not offer it and it should not appear in their booking list.
 */
export function resolveServicePricing(
  defaults: ServiceDefaults,
  tiers: readonly PricingTier[] | undefined,
  seniority: SeniorityName | null | undefined,
  override?: MemberServiceOverride | null,
): ResolvedServicePricing | null {
  if (override && override.isEnabled === false) {
    return null;
  }
  const tier = seniority ? tiers?.find((t) => t.seniority === seniority) : undefined;
  const priceCents = override?.priceCents ?? tier?.priceCents ?? defaults.priceCents;
  const durationMin = override?.durationMin ?? tier?.durationMin ?? defaults.durationMin;
  return { priceCents, durationMin, maxDaily: override?.maxDaily ?? null };
}
