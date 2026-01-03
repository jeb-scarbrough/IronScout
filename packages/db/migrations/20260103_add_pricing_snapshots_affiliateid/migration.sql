-- Add affiliateId column to pricing_snapshots table

ALTER TABLE "pricing_snapshots"
  ADD COLUMN IF NOT EXISTS "affiliateId" TEXT;

-- Add index for affiliate queries
CREATE INDEX IF NOT EXISTS "pricing_snapshots_affiliateId_idx"
  ON "pricing_snapshots"("affiliateId");
