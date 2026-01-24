-- Add Stripe payment fields to dealers table
-- These fields enable Stripe integration for automated dealer subscription billing

-- Add payment method enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerPaymentMethod') THEN
        CREATE TYPE "DealerPaymentMethod" AS ENUM ('STRIPE', 'PURCHASE_ORDER');
    END IF;
END$$;

-- Add Stripe and payment fields to dealers table
ALTER TABLE dealers
ADD COLUMN IF NOT EXISTS "paymentMethod" "DealerPaymentMethod",
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT true;

-- Add unique constraints for Stripe IDs (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dealers_stripeCustomerId_key'
    ) THEN
        ALTER TABLE dealers ADD CONSTRAINT dealers_stripeCustomerId_key UNIQUE ("stripeCustomerId");
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dealers_stripeSubscriptionId_key'
    ) THEN
        ALTER TABLE dealers ADD CONSTRAINT dealers_stripeSubscriptionId_key UNIQUE ("stripeSubscriptionId");
    END IF;
END$$;

-- Create indexes for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_dealers_stripe_customer
ON dealers("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dealers_stripe_subscription
ON dealers("stripeSubscriptionId") WHERE "stripeSubscriptionId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dealers_payment_method
ON dealers("paymentMethod") WHERE "paymentMethod" IS NOT NULL;

-- Comments
COMMENT ON COLUMN dealers."paymentMethod" IS 'Payment method: STRIPE (automated) or PURCHASE_ORDER (manual invoicing)';
COMMENT ON COLUMN dealers."stripeCustomerId" IS 'Stripe customer ID (cus_...) for billing';
COMMENT ON COLUMN dealers."stripeSubscriptionId" IS 'Stripe subscription ID (sub_...) for recurring billing';
COMMENT ON COLUMN dealers."autoRenew" IS 'Whether subscription auto-renews (default true for Stripe)';
