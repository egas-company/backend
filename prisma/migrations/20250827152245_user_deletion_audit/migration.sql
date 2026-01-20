-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appType" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "emailHash" TEXT,
ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "lastTokenUpdate" TIMESTAMP(3),
ADD COLUMN     "phoneHash" TEXT;

-- CreateTable
CREATE TABLE "UserDeletionAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneHash" TEXT,
    "emailHash" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDeletionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDeletionAudit_userId_createdAt_idx" ON "UserDeletionAudit"("userId", "createdAt");
