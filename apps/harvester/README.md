# IronScout.ai Harvester Service

Background ingestion service for IronScout.ai price data.

## Overview

The harvester service processes product pricing data from configured sources using a unified ingestion pattern. All data sources (affiliate feeds, retailer feeds, future scrapers) follow the same flow:

1. **Source-specific fetcher/parser** → Raw data
2. **Processor** → `source_products` + `source_product_identifiers`
3. **Product Resolver** → Links to canonical `products` via `product_links`
4. **Alerter** → Evaluates and triggers price alerts

## Ingestion Pipelines

### Affiliate Pipeline
Processes affiliate network feeds (Impact, AvantLink, etc.):
- Scheduled or manually triggered via BullMQ
- Parses CSV feeds, extracts identity signals
- Writes to `source_products` and enqueues resolver jobs

### Retailer Pipeline
Processes retailer-provided feeds:
- Supports URL, FTP, SFTP access methods
- Various formats: GENERIC, AMMOSEEK_V1, GUNENGINE_V2, IMPACT
- Admin can trigger manually or schedule recurring ingestion

### Product Resolver
Links source products to canonical products:
- UPC matching (for trusted sources)
- Fingerprint matching (brand + caliber + grain + packCount)
- Routes ambiguous items to NEEDS_REVIEW queue

## Prerequisites

- Redis server running (for BullMQ)
- PostgreSQL database (configured via DATABASE_URL)
- Node.js 20+

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Configure Redis and database in `.env`

4. Run database migrations (from root):
```bash
cd ../../packages/db
pnpm db:migrate
```

## Usage

### Start Worker Processes
Starts all pipeline workers to process jobs:
```bash
pnpm worker
```

Keep this running in a separate terminal.

### Bull Board (Queue Monitoring)
Start the queue monitoring dashboard:
```bash
pnpm bullboard:dev
```

Access at `http://localhost:3939/admin/queues` (requires BULLBOARD_USERNAME/PASSWORD).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                              │
├──────────────┬──────────────┬───────────────────────────────┤
│  Affiliate   │  Retailer    │   Future Scrapers             │
│  Feeds       │  Feeds       │   (see scraper-roadmap.md)    │
└──────┬───────┴──────┬───────┴───────────────────────────────┘
       │              │
       ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│              UNIFIED INGESTION PATTERN                       │
│                                                              │
│   1. Write source_products                                   │
│   2. Write source_product_identifiers (UPC, SKU, etc.)       │
│   3. Enqueue resolver job                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              PRODUCT RESOLVER (ADR-019)                      │
│                                                              │
│   UPC Lookup → Fingerprint Match → NEEDS_REVIEW             │
│   Creates product_links to canonical products               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              ALERTER                                         │
│                                                              │
│   Evaluates price changes and triggers notifications        │
└─────────────────────────────────────────────────────────────┘
```

## BullMQ Queues

| Queue | Purpose |
|-------|---------|
| `alert` | Price/stock change notifications |
| `retailer-feed-ingest` | Retailer feed processing |
| `affiliate-feed` | Affiliate feed processing |
| `affiliate-feed-scheduler` | Scheduled affiliate feed triggers |
| `product-resolve` | Product resolver jobs |
| `embedding-generate` | Vector embedding generation |
| `quarantine-reprocess` | Admin-triggered reprocessing |
| `current-price-recompute` | ADR-015 derived table rebuild |

## Monitoring

Check execution logs in the database:

```sql
-- Recent affiliate feed runs
SELECT * FROM affiliate_feed_runs ORDER BY started_at DESC LIMIT 10;

-- Recent retailer feed runs
SELECT * FROM retailer_feed_runs ORDER BY created_at DESC LIMIT 10;

-- Resolver request status
SELECT status, COUNT(*) FROM product_resolve_requests GROUP BY status;
```

## Extending

### Adding a New Affiliate Network

1. Add network-specific parser in `src/affiliate/`
2. Register in processor to handle new format
3. Add source to database with appropriate configuration

### Adding Notification Channels

Edit `src/alerter/index.ts` and implement notification delivery.

Options:
- Email (Resend)
- Webhooks
- Push notifications
- SMS

## Troubleshooting

**Workers not processing jobs:**
- Check Redis is running: `redis-cli ping`
- Verify DATABASE_URL is correct
- Check worker logs for errors

**Products not resolving:**
- Check `product_resolve_requests` for FAILED status
- Review resolver logs for matching failures
- Verify source has `source_product_identifiers` records

**Price alerts not triggering:**
- Check alert records are active
- Verify price changes in database
- Review alerter worker logs
