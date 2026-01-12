-- Add missing columns to prices table

-- Add merchantId column (nullable, for merchant-associated prices)
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "merchantId" TEXT;

-- Add sourceId column (nullable, for source-associated prices)
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

-- Add foreign key for merchantId
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'prices_merchantId_fkey') THEN
    ALTER TABLE "prices" ADD CONSTRAINT "prices_merchantId_fkey"
      FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add foreign key for sourceId
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'prices_sourceId_fkey') THEN
    ALTER TABLE "prices" ADD CONSTRAINT "prices_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "prices_merchantId_idx" ON "prices"("merchantId");
CREATE INDEX IF NOT EXISTS "prices_sourceId_idx" ON "prices"("sourceId");
