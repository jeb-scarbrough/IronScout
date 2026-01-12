-- Migration: Add onDelete: SetNull to FK relations
-- Prevents delete blocks and orphan rows when parent entities are removed.
-- Per schema review: prices/pricing_snapshots are immutable history, so SetNull preserves records.

-- ============================================================================
-- 1. prices.merchantId -> merchants: SetNull
-- ============================================================================

-- Drop existing constraint if exists
DO $$ BEGIN
    ALTER TABLE "prices" DROP CONSTRAINT IF EXISTS "prices_merchantId_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Re-add with SetNull
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prices' AND column_name = 'merchantId') THEN
        ALTER TABLE "prices" ADD CONSTRAINT "prices_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. prices.sourceId -> sources: SetNull
-- ============================================================================

-- Drop existing constraint if exists
DO $$ BEGIN
    ALTER TABLE "prices" DROP CONSTRAINT IF EXISTS "prices_sourceId_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Re-add with SetNull
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prices' AND column_name = 'sourceId') THEN
        ALTER TABLE "prices" ADD CONSTRAINT "prices_sourceId_fkey"
        FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. pricing_snapshots.retailerId -> retailers: SetNull
-- ============================================================================

-- Drop existing constraint if exists
DO $$ BEGIN
    ALTER TABLE "pricing_snapshots" DROP CONSTRAINT IF EXISTS "pricing_snapshots_retailerId_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Re-add with SetNull
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_snapshots') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'retailerId') THEN
            ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_retailerId_fkey"
            FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. pricing_snapshots.sourceId -> sources: SetNull
-- ============================================================================

-- Drop existing constraint if exists
DO $$ BEGIN
    ALTER TABLE "pricing_snapshots" DROP CONSTRAINT IF EXISTS "pricing_snapshots_sourceId_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Re-add with SetNull
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_snapshots') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'sourceId') THEN
            ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_sourceId_fkey"
            FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 5. retailers.merchantId -> merchants: SetNull (DEPRECATED legacy field)
-- Only applies if the column exists (it may not in all environments)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retailers' AND column_name = 'merchantId') THEN
        -- Drop existing constraint if exists
        ALTER TABLE "retailers" DROP CONSTRAINT IF EXISTS "retailers_merchantId_fkey";

        -- Re-add with SetNull
        ALTER TABLE "retailers" ADD CONSTRAINT "retailers_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

        COMMENT ON COLUMN "retailers"."merchantId" IS 'DEPRECATED: Legacy optional link to merchant. Use merchant_retailers join table. Will be removed once all writers use merchant_retailers exclusively.';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
