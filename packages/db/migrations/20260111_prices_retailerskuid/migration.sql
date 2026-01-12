-- Add retailerSkuId FK to prices table
-- PR #2: Unified prices table supports both canonical products and retailer SKUs
-- Prices can now be linked to retailer_skus directly (for feeds not yet matched to products)

-- Add retailerSkuId column (nullable - only set for retailer feed prices)
ALTER TABLE "prices"
  ADD COLUMN "retailerSkuId" TEXT;

-- Add FK constraint to retailer_skus
ALTER TABLE "prices"
  ADD CONSTRAINT "prices_retailerSkuId_fkey"
  FOREIGN KEY ("retailerSkuId")
  REFERENCES "retailer_skus"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Add index for retailerSkuId lookups
CREATE INDEX "prices_retailerSkuId_idx" ON "prices"("retailerSkuId");
