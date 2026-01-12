-- Migration: Add SKIPPED status to ProductLinkStatus enum
-- Purpose: Allow admin to mark review items as skipped (terminal state)

-- ═══════════════════════════════════════════════════════════════════════════════
-- Add SKIPPED to ProductLinkStatus enum
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TYPE "ProductLinkStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

SELECT 'Migration 20260109_add_skipped_status completed successfully' as status;
