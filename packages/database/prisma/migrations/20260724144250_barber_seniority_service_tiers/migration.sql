-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('JUNIOR', 'NORMAL', 'SENIOR');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "seniority" "Seniority",
ADD COLUMN     "stationNo" INTEGER;

-- CreateTable
CREATE TABLE "ServiceTier" (
    "serviceId" TEXT NOT NULL,
    "seniority" "Seniority" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "serviceNo" TEXT,

    CONSTRAINT "ServiceTier_pkey" PRIMARY KEY ("serviceId","seniority")
);

-- CreateTable
CREATE TABLE "TeamMemberService" (
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priceCents" INTEGER,
    "durationMin" INTEGER,
    "maxDaily" INTEGER,

    CONSTRAINT "TeamMemberService_pkey" PRIMARY KEY ("userId","serviceId")
);

-- CreateIndex
CREATE INDEX "TeamMemberService_serviceId_idx" ON "TeamMemberService"("serviceId");

-- AddForeignKey
ALTER TABLE "ServiceTier" ADD CONSTRAINT "ServiceTier_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberService" ADD CONSTRAINT "TeamMemberService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberService" ADD CONSTRAINT "TeamMemberService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
