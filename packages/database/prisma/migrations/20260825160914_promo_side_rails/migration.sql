-- CreateEnum
CREATE TYPE "PromoRail" AS ENUM ('LEFT_AD', 'RIGHT_SOCIAL');

-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('INSTAGRAM', 'TIKTOK');

-- CreateTable
CREATE TABLE "PromoTile" (
    "id" TEXT NOT NULL,
    "rail" "PromoRail" NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT NOT NULL,
    "videoUrl" TEXT,
    "linkUrl" TEXT NOT NULL,
    "network" "SocialNetwork",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoTile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoTile_rail_isActive_sortOrder_idx" ON "PromoTile"("rail", "isActive", "sortOrder");
