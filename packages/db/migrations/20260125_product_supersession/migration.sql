-- Product Supersession Fields
-- Per firearm_preferred_ammo_mapping_spec_v3.md
-- Enables SKU aliasing for ammo preference preservation

-- Add supersession fields to products table
ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "isActiveSku" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "supersededById" TEXT;

ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "supersededAt" TIMESTAMP(3);

-- Add self-referencing foreign key for supersession chain
ALTER TABLE "products"
ADD CONSTRAINT "products_supersededById_fkey"
FOREIGN KEY ("supersededById") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for efficient supersession lookups
CREATE INDEX IF NOT EXISTS "products_supersededById_idx"
ON "products" ("supersededById");

-- Index for filtering active SKUs
CREATE INDEX IF NOT EXISTS "products_isActiveSku_idx"
ON "products" ("isActiveSku");
