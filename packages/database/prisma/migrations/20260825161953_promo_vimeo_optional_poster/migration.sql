-- AlterEnum
ALTER TYPE "SocialNetwork" ADD VALUE 'VIMEO';

-- AlterTable
ALTER TABLE "PromoTile" ALTER COLUMN "imageUrl" DROP NOT NULL;
