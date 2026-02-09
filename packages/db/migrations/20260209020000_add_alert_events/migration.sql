-- CreateEnum
CREATE TYPE "AlertEventType" AS ENUM ('PRICE_DROP', 'BACK_IN_STOCK');

-- CreateEnum
CREATE TYPE "AlertDeliveryChannel" AS ENUM ('EMAIL');

-- CreateTable
CREATE TABLE "alert_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "watchlistItemId" TEXT,
  "alertId" TEXT,
  "productId" TEXT,
  "retailerId" TEXT,
  "sourceId" TEXT,
  "triggerPriceId" TEXT,
  "eventType" "AlertEventType" NOT NULL,
  "triggeredAt" TIMESTAMPTZ NOT NULL,
  "priceAtTrigger" DECIMAL(10,2),
  "previousPrice" DECIMAL(10,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "deliveryChannel" "AlertDeliveryChannel" NOT NULL DEFAULT 'EMAIL',
  "providerMessageId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- FK Constraints (all SET NULL to preserve history per spec §4)
ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_watchlistItemId_fkey"
  FOREIGN KEY ("watchlistItemId") REFERENCES "watchlist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_alertId_fkey"
  FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_triggerPriceId_fkey"
  FOREIGN KEY ("triggerPriceId") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique idempotency key (spec §5)
CREATE UNIQUE INDEX "alert_events_idempotencyKey_key"
  ON "alert_events"("idempotencyKey");

-- Read path indexes (spec §4)
CREATE INDEX "alert_events_userId_triggeredAt_idx"
  ON "alert_events"("userId", "triggeredAt" DESC);

CREATE INDEX "alert_events_watchlistItemId_triggeredAt_idx"
  ON "alert_events"("watchlistItemId", "triggeredAt" DESC);

CREATE INDEX "alert_events_productId_triggeredAt_idx"
  ON "alert_events"("productId", "triggeredAt" DESC);

CREATE INDEX "alert_events_triggerPriceId_idx"
  ON "alert_events"("triggerPriceId");
