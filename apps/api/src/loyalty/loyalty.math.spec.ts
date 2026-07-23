import { LoyaltyTier } from '@ta-spiru/database';
import { pointsForAmount, tierForLifetime } from './loyalty.math';

describe('pointsForAmount', () => {
  it('awards 1 point per whole euro', () => {
    expect(pointsForAmount(2500)).toBe(25);
    expect(pointsForAmount(9500)).toBe(95);
  });

  it('floors partial euros', () => {
    expect(pointsForAmount(2599)).toBe(25);
    expect(pointsForAmount(99)).toBe(0);
  });

  it('is zero for a zero charge', () => {
    expect(pointsForAmount(0)).toBe(0);
  });
});

describe('tierForLifetime', () => {
  it('starts at BRONZE', () => {
    expect(tierForLifetime(0)).toBe(LoyaltyTier.BRONZE);
    expect(tierForLifetime(499)).toBe(LoyaltyTier.BRONZE);
  });

  it('promotes to SILVER at 500 lifetime points', () => {
    expect(tierForLifetime(500)).toBe(LoyaltyTier.SILVER);
    expect(tierForLifetime(1499)).toBe(LoyaltyTier.SILVER);
  });

  it('promotes to GOLD at 1500 lifetime points', () => {
    expect(tierForLifetime(1500)).toBe(LoyaltyTier.GOLD);
    expect(tierForLifetime(9999)).toBe(LoyaltyTier.GOLD);
  });
});
