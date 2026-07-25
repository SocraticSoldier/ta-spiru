-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0;
