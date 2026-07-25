-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- AlterEnum
ALTER TYPE "StockMovementKind" ADD VALUE 'RETURN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "contactChannels" "ContactChannel"[] DEFAULT ARRAY['EMAIL', 'SMS', 'PUSH']::"ContactChannel"[],
ADD COLUMN     "isTaSpiruStaff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "staffNumber" TEXT,
ADD COLUMN     "workplace" TEXT;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "barberId" TEXT,
    "overall" INTEGER NOT NULL,
    "answers" INTEGER[],
    "comment" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sharedGoogle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");

-- CreateIndex
CREATE INDEX "Review_barberId_isPublished_idx" ON "Review"("barberId", "isPublished");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
