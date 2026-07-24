-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'RECEPTION', 'WALK_IN');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'LATE';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'ONLINE';

-- CreateTable
CREATE TABLE "ServiceChangeLog" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "overlapAccepted" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceChangeLog_createdAt_idx" ON "ServiceChangeLog"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceChangeLog_acknowledged_idx" ON "ServiceChangeLog"("acknowledged");

-- AddForeignKey
ALTER TABLE "ServiceChangeLog" ADD CONSTRAINT "ServiceChangeLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChangeLog" ADD CONSTRAINT "ServiceChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
