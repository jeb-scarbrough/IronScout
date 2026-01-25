-- Add imageUrl and updatedAt to user_guns for gun locker images
-- Phase 1: Postgres-first storage (base64 data URLs)
-- Phase 2: Migration to R2 (https URLs) when volume justifies

ALTER TABLE "user_guns" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "user_guns" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
