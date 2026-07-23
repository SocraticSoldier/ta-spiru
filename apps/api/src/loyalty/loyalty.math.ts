import { LoyaltyTier } from '@ta-spiru/database';

export const SILVER_LIFETIME_POINTS = 500;
export const GOLD_LIFETIME_POINTS = 1500;

/** 1 point per whole euro of settled spend. */
export const pointsForAmount = (amountCents: number): number => Math.floor(amountCents / 100);

export const tierForLifetime = (lifetimePoints: number): LoyaltyTier => {
  if (lifetimePoints >= GOLD_LIFETIME_POINTS) {
    return LoyaltyTier.GOLD;
  }
  if (lifetimePoints >= SILVER_LIFETIME_POINTS) {
    return LoyaltyTier.SILVER;
  }
  return LoyaltyTier.BRONZE;
};
