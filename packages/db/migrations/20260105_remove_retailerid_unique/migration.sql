-- Migration: Remove retailerId @unique constraint from merchant_retailers
-- Purpose: Unblock 1:many relationship (one retailer can belong to multiple merchants)
-- The @@unique([merchantId, retailerId]) constraint remains to prevent duplicate relationships.

-- Drop the unique constraint on retailerId
-- Prisma generates unique constraints with the naming pattern: <table>_<column>_key
ALTER TABLE "merchant_retailers" DROP CONSTRAINT IF EXISTS "merchant_retailers_retailerId_key";
