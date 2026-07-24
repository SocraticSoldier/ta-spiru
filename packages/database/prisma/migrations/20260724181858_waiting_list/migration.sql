-- CreateEnum
CREATE TYPE "WaitingListStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WaitingListEntry" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "barberId" TEXT,
    "serviceId" TEXT NOT NULL,
    "forDate" TIMESTAMP(3) NOT NULL,
    "status" "WaitingListStatus" NOT NULL DEFAULT 'WAITING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitingListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitingListEntry_locationId_forDate_status_idx" ON "WaitingListEntry"("locationId", "forDate", "status");

-- CreateIndex
CREATE INDEX "WaitingListEntry_barberId_forDate_status_idx" ON "WaitingListEntry"("barberId", "forDate", "status");

-- AddForeignKey
ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
