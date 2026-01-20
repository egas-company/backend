/*
  Warnings:

  - A unique constraint covering the columns `[trackingId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount` to the `Order` table without a default value. This is not possible if the table is not empty.
  - The required column `trackingId` was added to the `Order` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "tankSizeId" TEXT,
ADD COLUMN     "trackingId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pushToken" TEXT;

-- CreateTable
CREATE TABLE "TankSize" (
    "id" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TankSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TankSize_size_key" ON "TankSize"("size");

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingId_key" ON "Order"("trackingId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tankSizeId_fkey" FOREIGN KEY ("tankSizeId") REFERENCES "TankSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;
