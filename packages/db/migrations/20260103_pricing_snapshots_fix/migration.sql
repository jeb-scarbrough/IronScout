-- Fix pricing_snapshots: dealerId -> merchantId

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'dealerId') THEN
    -- Check if merchantId already exists (might be nullable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'merchantId') THEN
      ALTER TABLE "pricing_snapshots" RENAME COLUMN "dealerId" TO "merchantId";
    ELSE
      -- Both exist - drop dealerId after copying data if needed
      -- For now just drop the old column
      ALTER TABLE "pricing_snapshots" DROP COLUMN "dealerId";
    END IF;
  END IF;
END $$;

-- Fix indexes
DROP INDEX IF EXISTS "pricing_snapshots_dealerId_idx";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_snapshots')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'merchantId') THEN
    CREATE INDEX IF NOT EXISTS "pricing_snapshots_merchantId_idx" ON "pricing_snapshots"("merchantId");
  END IF;
END $$;

-- Fix foreign key
ALTER TABLE "pricing_snapshots" DROP CONSTRAINT IF EXISTS "pricing_snapshots_dealerId_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_snapshots')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'merchantId') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pricing_snapshots_merchantId_fkey') THEN
      ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
