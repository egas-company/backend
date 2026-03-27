/*
  Warnings:

  - The values [SUCCESS] on the enum `NotificationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationStatus_new" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED');
ALTER TABLE "NotificationLog" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "NotificationLog" ALTER COLUMN "status" TYPE "NotificationStatus_new" USING ("status"::text::"NotificationStatus_new");
ALTER TYPE "NotificationStatus" RENAME TO "NotificationStatus_old";
ALTER TYPE "NotificationStatus_new" RENAME TO "NotificationStatus";
DROP TYPE "NotificationStatus_old";
ALTER TABLE "NotificationLog" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "NotificationDevice" ALTER COLUMN "updatedAt" DROP DEFAULT;
