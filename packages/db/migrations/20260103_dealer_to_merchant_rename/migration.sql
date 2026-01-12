-- Dealer to Merchant Terminology Migration
-- This migration renames all dealer_* tables, Dealer* enums, and dealerId columns
-- to use merchant terminology consistently.
--
-- IMPORTANT: This migration should be run during a maintenance window as it
-- involves table renames which acquire exclusive locks.

-- ============================================================================
-- Part 1: Rename Enums (with existence checks)
-- ============================================================================
-- PostgreSQL requires ALTER TYPE ... RENAME TO for enum renames

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerContactRole') THEN
    ALTER TYPE "DealerContactRole" RENAME TO "MerchantContactRole";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerPaymentMethod') THEN
    ALTER TYPE "DealerPaymentMethod" RENAME TO "MerchantPaymentMethod";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerStatus') THEN
    ALTER TYPE "DealerStatus" RENAME TO "MerchantStatus";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerSubscriptionStatus') THEN
    ALTER TYPE "DealerSubscriptionStatus" RENAME TO "MerchantSubscriptionStatus";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerTier') THEN
    ALTER TYPE "DealerTier" RENAME TO "MerchantTier";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerUserRole') THEN
    ALTER TYPE "DealerUserRole" RENAME TO "MerchantUserRole";
  END IF;
END $$;

-- ============================================================================
-- Part 2: Rename Tables
-- ============================================================================
-- Rename all dealer_* tables to merchant_*

ALTER TABLE IF EXISTS "dealer_contacts" RENAME TO "merchant_contacts";
ALTER TABLE IF EXISTS "dealer_feed_runs" RENAME TO "merchant_feed_runs";
ALTER TABLE IF EXISTS "dealer_feed_test_runs" RENAME TO "merchant_feed_test_runs";
ALTER TABLE IF EXISTS "dealer_feeds" RENAME TO "merchant_feeds";
ALTER TABLE IF EXISTS "dealer_insights" RENAME TO "merchant_insights";
ALTER TABLE IF EXISTS "dealer_invites" RENAME TO "merchant_invites";
ALTER TABLE IF EXISTS "dealer_notification_prefs" RENAME TO "merchant_notification_prefs";
ALTER TABLE IF EXISTS "dealer_skus" RENAME TO "merchant_skus";
ALTER TABLE IF EXISTS "dealer_users" RENAME TO "merchant_users";
ALTER TABLE IF EXISTS "dealer_retailers" RENAME TO "merchant_retailers";
ALTER TABLE IF EXISTS "dealer_user_retailers" RENAME TO "merchant_user_retailers";

-- Also rename the main dealers table if it exists
ALTER TABLE IF EXISTS "dealers" RENAME TO "merchants";

-- ============================================================================
-- Part 3: Rename Columns (dealerId -> merchantId)
-- ============================================================================
-- All renames wrapped in conditionals to handle partial migrations gracefully

-- admin_audit_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_logs' AND column_name = 'dealerId') THEN
    ALTER TABLE "admin_audit_logs" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- Drop and recreate index with new name
DROP INDEX IF EXISTS "admin_audit_logs_dealerId_idx";
CREATE INDEX IF NOT EXISTS "admin_audit_logs_merchantId_idx" ON "admin_audit_logs"("merchantId");

-- merchant_contacts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_contacts' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_contacts" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_feed_runs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_feed_runs' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_feed_runs" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_feed_test_runs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_feed_test_runs' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_feed_test_runs" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_feeds
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_feeds' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_feeds" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_insights
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_insights' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_insights" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_invites
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_invites' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_invites" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_notification_prefs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_notification_prefs' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_notification_prefs" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_skus
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_skus' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_skus" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_users' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_users" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_retailers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_retailers' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_retailers" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_user_retailers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_user_retailers' AND column_name = 'dealerId') THEN
    ALTER TABLE "merchant_user_retailers" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- ============================================================================
-- Part 4: Rename Foreign Key Constraints
-- ============================================================================
-- Rename FK constraints to match new naming convention
-- All wrapped in conditionals to handle missing tables gracefully

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_contacts') THEN
    ALTER TABLE "merchant_contacts" DROP CONSTRAINT IF EXISTS "dealer_contacts_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_contacts_merchantId_fkey') THEN
      ALTER TABLE "merchant_contacts" ADD CONSTRAINT "merchant_contacts_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_feed_runs') THEN
    ALTER TABLE "merchant_feed_runs" DROP CONSTRAINT IF EXISTS "dealer_feed_runs_dealerId_fkey";
    ALTER TABLE "merchant_feed_runs" DROP CONSTRAINT IF EXISTS "dealer_feed_runs_feedId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_feed_runs_merchantId_fkey') THEN
      ALTER TABLE "merchant_feed_runs" ADD CONSTRAINT "merchant_feed_runs_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_feed_runs_feedId_fkey') THEN
      ALTER TABLE "merchant_feed_runs" ADD CONSTRAINT "merchant_feed_runs_feedId_fkey"
        FOREIGN KEY ("feedId") REFERENCES "merchant_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_feed_test_runs') THEN
    ALTER TABLE "merchant_feed_test_runs" DROP CONSTRAINT IF EXISTS "dealer_feed_test_runs_dealerId_fkey";
    ALTER TABLE "merchant_feed_test_runs" DROP CONSTRAINT IF EXISTS "dealer_feed_test_runs_feedId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_feed_test_runs_merchantId_fkey') THEN
      ALTER TABLE "merchant_feed_test_runs" ADD CONSTRAINT "merchant_feed_test_runs_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_feed_test_runs_feedId_fkey') THEN
      ALTER TABLE "merchant_feed_test_runs" ADD CONSTRAINT "merchant_feed_test_runs_feedId_fkey"
        FOREIGN KEY ("feedId") REFERENCES "merchant_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_feeds') THEN
    ALTER TABLE "merchant_feeds" DROP CONSTRAINT IF EXISTS "dealer_feeds_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_feeds_merchantId_fkey') THEN
      ALTER TABLE "merchant_feeds" ADD CONSTRAINT "merchant_feeds_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_insights') THEN
    ALTER TABLE "merchant_insights" DROP CONSTRAINT IF EXISTS "dealer_insights_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_insights_merchantId_fkey') THEN
      ALTER TABLE "merchant_insights" ADD CONSTRAINT "merchant_insights_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_invites') THEN
    ALTER TABLE "merchant_invites" DROP CONSTRAINT IF EXISTS "dealer_invites_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_invites_merchantId_fkey') THEN
      ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_notification_prefs') THEN
    ALTER TABLE "merchant_notification_prefs" DROP CONSTRAINT IF EXISTS "dealer_notification_prefs_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_notification_prefs_merchantId_fkey') THEN
      ALTER TABLE "merchant_notification_prefs" ADD CONSTRAINT "merchant_notification_prefs_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_skus') THEN
    ALTER TABLE "merchant_skus" DROP CONSTRAINT IF EXISTS "dealer_skus_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_skus_merchantId_fkey') THEN
      ALTER TABLE "merchant_skus" ADD CONSTRAINT "merchant_skus_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_users') THEN
    ALTER TABLE "merchant_users" DROP CONSTRAINT IF EXISTS "dealer_users_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_users_merchantId_fkey') THEN
      ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_retailers') THEN
    ALTER TABLE "merchant_retailers" DROP CONSTRAINT IF EXISTS "dealer_retailers_dealerId_fkey";
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_retailers_merchantId_fkey') THEN
      ALTER TABLE "merchant_retailers" ADD CONSTRAINT "merchant_retailers_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Part 5: Rename Indexes (conditional on table existence)
-- ============================================================================

-- Drop all old dealer indexes (safe even if they don't exist)
DROP INDEX IF EXISTS "dealer_contacts_dealerId_idx";
DROP INDEX IF EXISTS "dealer_feeds_dealerId_idx";
DROP INDEX IF EXISTS "dealer_feed_runs_dealerId_idx";
DROP INDEX IF EXISTS "dealer_feed_runs_feedId_idx";
DROP INDEX IF EXISTS "dealer_insights_dealerId_idx";
DROP INDEX IF EXISTS "dealer_invites_dealerId_idx";
DROP INDEX IF EXISTS "dealer_skus_dealerId_idx";
DROP INDEX IF EXISTS "dealer_skus_dealerId_productId_key";
DROP INDEX IF EXISTS "dealer_users_dealerId_idx";
DROP INDEX IF EXISTS "dealer_users_dealerId_userId_key";
DROP INDEX IF EXISTS "dealer_retailers_dealerId_idx";
DROP INDEX IF EXISTS "dealer_retailers_dealerId_retailerId_key";

-- Create new indexes conditionally
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_contacts') THEN
    CREATE INDEX IF NOT EXISTS "merchant_contacts_merchantId_idx" ON "merchant_contacts"("merchantId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_feeds') THEN
    CREATE INDEX IF NOT EXISTS "merchant_feeds_merchantId_idx" ON "merchant_feeds"("merchantId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_feed_runs') THEN
    CREATE INDEX IF NOT EXISTS "merchant_feed_runs_merchantId_idx" ON "merchant_feed_runs"("merchantId");
    CREATE INDEX IF NOT EXISTS "merchant_feed_runs_feedId_idx" ON "merchant_feed_runs"("feedId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_insights') THEN
    CREATE INDEX IF NOT EXISTS "merchant_insights_merchantId_idx" ON "merchant_insights"("merchantId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_invites') THEN
    CREATE INDEX IF NOT EXISTS "merchant_invites_merchantId_idx" ON "merchant_invites"("merchantId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_skus') THEN
    CREATE INDEX IF NOT EXISTS "merchant_skus_merchantId_idx" ON "merchant_skus"("merchantId");
    -- Note: merchant_skus uses rawSku not productId for uniqueness
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_users') THEN
    CREATE INDEX IF NOT EXISTS "merchant_users_merchantId_idx" ON "merchant_users"("merchantId");
    CREATE UNIQUE INDEX IF NOT EXISTS "merchant_users_merchantId_email_key" ON "merchant_users"("merchantId", "email");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_retailers') THEN
    CREATE INDEX IF NOT EXISTS "merchant_retailers_merchantId_idx" ON "merchant_retailers"("merchantId");
    CREATE UNIQUE INDEX IF NOT EXISTS "merchant_retailers_retailerId_key" ON "merchant_retailers"("retailerId");
  END IF;
END $$;

-- ============================================================================
-- Part 6: Update Sequences (if any)
-- ============================================================================

-- Rename sequences if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'dealers_id_seq') THEN
    ALTER SEQUENCE "dealers_id_seq" RENAME TO "merchants_id_seq";
  END IF;
END $$;
