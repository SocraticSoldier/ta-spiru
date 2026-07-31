-- CreateEnum
CREATE TYPE "LoginKind" AS ENUM ('PASSWORD', 'STATION_PIN');

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "kind" "LoginKind" NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "succeeded" BOOLEAN NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_kind_identifier_createdAt_idx" ON "LoginAttempt"("kind", "identifier", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
