-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPlatform') THEN
    CREATE TYPE "NotificationPlatform" AS ENUM ('ANDROID', 'IOS', 'WEB', 'UNKNOWN');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationApp') THEN
    CREATE TYPE "NotificationApp" AS ENUM ('USER', 'DRIVER', 'ADMIN');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
    CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverAssignmentAlarmStatus') THEN
    CREATE TYPE "DriverAssignmentAlarmStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'CANCELLED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "driverId" TEXT,
    "token" TEXT NOT NULL,
    "platform" "NotificationPlatform" NOT NULL DEFAULT 'UNKNOWN',
    "app" "NotificationApp" NOT NULL DEFAULT 'USER',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "userId" TEXT,
    "driverId" TEXT,
    "type" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "payload" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DriverAssignmentAlarm" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "DriverAssignmentAlarmStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "repeatJobKey" TEXT,

    CONSTRAINT "DriverAssignmentAlarm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDevice_token_key" ON "NotificationDevice"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDevice_userId_idx" ON "NotificationDevice"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDevice_driverId_idx" ON "NotificationDevice"("driverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDevice_app_idx" ON "NotificationDevice"("app");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_type_idx" ON "NotificationLog"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_deviceId_idx" ON "NotificationLog"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DriverAssignmentAlarm_orderId_key" ON "DriverAssignmentAlarm"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DriverAssignmentAlarm_driverId_idx" ON "DriverAssignmentAlarm"("driverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DriverAssignmentAlarm_status_idx" ON "DriverAssignmentAlarm"("status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationDevice_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationDevice" ADD CONSTRAINT "NotificationDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationDevice_driverId_fkey'
  ) THEN
    ALTER TABLE "NotificationDevice" ADD CONSTRAINT "NotificationDevice_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationLog_deviceId_fkey'
  ) THEN
    ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "NotificationDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationLog_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationLog_driverId_fkey'
  ) THEN
    ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DriverAssignmentAlarm_orderId_fkey'
  ) THEN
    ALTER TABLE "DriverAssignmentAlarm" ADD CONSTRAINT "DriverAssignmentAlarm_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DriverAssignmentAlarm_driverId_fkey'
  ) THEN
    ALTER TABLE "DriverAssignmentAlarm" ADD CONSTRAINT "DriverAssignmentAlarm_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
