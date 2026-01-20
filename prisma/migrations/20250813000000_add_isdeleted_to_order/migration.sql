-- Add isDeleted column to Order table
ALTER TABLE "Order" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance
CREATE INDEX "Order_isDeleted_idx" ON "Order"("isDeleted"); 