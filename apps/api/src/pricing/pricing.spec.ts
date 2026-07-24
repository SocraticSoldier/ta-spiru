import { resolveServicePricing, type PricingTier } from '@ta-spiru/shared';

const defaults = { priceCents: 1400, durationMin: 40 };
const tiers: PricingTier[] = [
  { seniority: 'JUNIOR', priceCents: 1300, durationMin: 40 },
  { seniority: 'NORMAL', priceCents: 1400, durationMin: 40 },
  { seniority: 'SENIOR', priceCents: 1600, durationMin: 40 },
];

describe('resolveServicePricing', () => {
  it('falls back to the service default when there is no tier or override', () => {
    expect(resolveServicePricing(defaults, undefined, null)).toEqual({
      priceCents: 1400,
      durationMin: 40,
      maxDaily: null,
    });
  });

  it('applies the seniority tier', () => {
    expect(resolveServicePricing(defaults, tiers, 'SENIOR')).toEqual({
      priceCents: 1600,
      durationMin: 40,
      maxDaily: null,
    });
    expect(resolveServicePricing(defaults, tiers, 'JUNIOR')?.priceCents).toBe(1300);
  });

  it('lets a per-member override win over the tier', () => {
    const r = resolveServicePricing(defaults, tiers, 'SENIOR', {
      isEnabled: true,
      priceCents: 1100,
      durationMin: 15,
      maxDaily: 4,
    });
    expect(r).toEqual({ priceCents: 1100, durationMin: 15, maxDaily: 4 });
  });

  it('falls through partial overrides to the tier, then default', () => {
    // Only duration overridden -> price still comes from the tier.
    const r = resolveServicePricing(defaults, tiers, 'SENIOR', {
      isEnabled: true,
      durationMin: 30,
    });
    expect(r).toEqual({ priceCents: 1600, durationMin: 30, maxDaily: null });
  });

  it('returns null when the barber has disabled the service', () => {
    expect(resolveServicePricing(defaults, tiers, 'NORMAL', { isEnabled: false })).toBeNull();
  });

  it('carries the daily cap through', () => {
    const r = resolveServicePricing(defaults, tiers, 'NORMAL', { isEnabled: true, maxDaily: 6 });
    expect(r?.maxDaily).toBe(6);
  });
});
