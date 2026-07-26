-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('HAIRCUT', 'BEARD', 'ADDON', 'WASH');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "category" "ServiceCategory" NOT NULL DEFAULT 'ADDON';

-- Backfill: existing rows all land on ADDON by default, but the booking flow
-- now walks Haircuts -> Beards -> Add-ons, so sort the live menu into its cards.
UPDATE "Service" SET "category" = 'WASH' WHERE "kind" = 'WASH';

UPDATE "Service" SET "category" = 'BEARD'
WHERE "kind" = 'BARBER' AND "slug" IN (
  'beard-grooming',
  'beard-clean-shave',
  'hot-towel-beard-grooming',
  'hot-towel-beard-clean-shave',
  'premium-beard-clean-shave'
);

UPDATE "Service" SET "category" = 'HAIRCUT'
WHERE "kind" = 'BARBER' AND "slug" IN (
  'boy-haircut',
  'boy-scissors-haircut',
  'haircut',
  'skin-fade',
  'clipper-head-shave',
  'clean-head-shave',
  'hot-towel-clean-head-shave',
  'premium-clean-head-shave',
  'scissors-classic-haircut',
  'long-scissors-haircut',
  'senior-haircut',
  'hairstyling'
);
