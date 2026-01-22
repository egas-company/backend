-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryPin" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pinGeneratedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_deliveryPin_idx" ON "Order"("deliveryPin");

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentDeviceId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deviceIdUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_deviceId_idx" ON "User"("deviceId");

-- AlterEnum (if needed - check if enum values already exist)
-- Note: This might fail if enum values already exist, which is fine
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SENT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationStatus')) THEN
        ALTER TYPE "NotificationStatus" ADD VALUE 'SENT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DELIVERED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationStatus')) THEN
        ALTER TYPE "NotificationStatus" ADD VALUE 'DELIVERED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EXPIRED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationStatus')) THEN
        ALTER TYPE "NotificationStatus" ADD VALUE 'EXPIRED';
    END IF;
END $$;
