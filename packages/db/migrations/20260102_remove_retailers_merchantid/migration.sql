-- Remove deprecated retailers.merchantId column
-- This field was replaced by the merchant_retailers join table
-- See ADR-016 for context

-- Drop the index first
DROP INDEX IF EXISTS "retailers_merchantId_idx";

-- Drop the foreign key constraint
ALTER TABLE "retailers" DROP CONSTRAINT IF EXISTS "retailers_merchantId_fkey";

-- Drop the column
ALTER TABLE "retailers" DROP COLUMN IF EXISTS "merchantId";
