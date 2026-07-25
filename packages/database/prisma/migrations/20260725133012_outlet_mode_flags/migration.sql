-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "isBarberOperated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "virtualQueueEnabled" BOOLEAN NOT NULL DEFAULT false;
