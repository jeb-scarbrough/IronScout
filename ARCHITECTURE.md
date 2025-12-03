# IronScout.ai Scalable Ingestion Pipeline Architecture

## High-Level Flow

```
[Affiliate Feeds] ─┐
                   ├─> [Parser Layer] -> [Normalizer] -> [DB]
[Scrapers] ────────┘
```

## Implementation Status

### ✅ Completed Components

#### 1. Database Schema (`packages/db/schema.prisma`)
- **Product**: UPC (unique), caliber, grain_weight, case_material, purpose, round_count, metadata
- **Retailer**: name, website (unique), tier, network affiliation
- **Price**: product_id, retailer_id, price, in_stock, url, created_at
- **Source**: Affiliate network configuration, feed hash for change detection
- **Execution/ExecutionLog**: Full crawl tracking and debugging

#### 2. Normalization Layer (`apps/harvester/src/normalizer/`)
- ✅ `ammo-utils.ts` - Comprehensive ammo normalization
  - `extractCaliber()` - 40+ caliber patterns
  - `extractGrainWeight()` - Grain extraction with validation
  - `extractCaseMaterial()` - Brass, Steel, Aluminum, Nickel, Polymer
  - `classifyPurpose()` - FMJ=Target, JHP=Defense, SP=Hunting, OTM=Precision
  - `extractRoundCount()` - Rounds per box
  - `generateProductId()` - UPC-first, hash fallback
  - `normalizeAmmoProduct()` - Orchestrates all normalization

- ✅ `index.ts` - Integrated into pipeline
  - Calls `normalizeAmmoProduct()` for each item
  - Outputs unified `NormalizedProduct` with ammo fields

#### 3. Parser Layer (`apps/harvester/src/parsers/`)
- ✅ **Base Interface** - `FeedParser` with unified `ParsedProduct` output
- ✅ **ImpactParser** - Auto-detects CSV/XML/JSON
- ✅ **AvantLinkParser** - Supports CSV/XML/JSON with AvantLink field mappings
- ✅ **ShareASaleParser** - Supports pipe-delimited CSV, XML, JSON

#### 4. Writer Layer (`apps/harvester/src/writer/`)
- ✅ UPC-based product consolidation
- ✅ Upserts Product with all ammo fields
- ✅ Upserts Retailer with unique website constraint
- ✅ Creates Price records with product_id + retailer_id

#### 5. Fetcher Layer (`apps/harvester/src/fetcher/`)
- ✅ Pagination support (query params, path-based)
- ✅ Auto-detection of empty results
- ✅ **Feed hash caching** - SHA-256 hash comparison for change detection
- ✅ **Route to parser vs scraper** - Automatic routing based on affiliateNetwork

### ⚠️ Pending Components

#### 6. Scheduler Configuration
**Purpose**: Different refresh cycles for feeds vs scrapers

**Current**: All sources use `interval` field (seconds)
**Enhancement**: Respect source type for scheduling

- **Feeds**: 43200 seconds (12 hours) or 86400 (daily)
- **Scrapers**: 3600-14400 seconds (1-4 hours)

**File**: `apps/harvester/src/scheduler/index.ts`

#### 7. Scraper Layer (Playwright)
**Purpose**: Handle JavaScript-rendered pages

**When to use**:
- Source type = `JS_RENDERED`
- Site requires JavaScript to load products
- Anti-bot protection

**Implementation**:
```typescript
// apps/harvester/src/fetcher/playwright-fetcher.ts
import playwright from 'playwright'

export async function fetchWithPlaywright(url: string) {
  const browser = await playwright.chromium.launch()
  const page = await browser.newPage()
  await page.goto(url)
  const content = await page.content()
  await browser.close()
  return content
}
```

## Data Flow Examples

### Affiliate Feed Flow

```
1. Scheduler triggers feed refresh (12h interval)
2. Fetcher downloads feed → checks hash
   - If unchanged: Skip
   - If changed: Continue
3. Parser (ImpactParser) parses CSV/XML/JSON
   Output: { retailer, name, price, upc, ... }
4. Normalizer extracts ammo metadata
   Output: { productId, caliber, grain, case, purpose, ... }
5. Writer upserts to DB
   - Product (by productId/UPC)
   - Retailer (by website)
   - Price (new record)
```

### Scraper Flow

```
1. Scheduler triggers scrape (1-4h interval)
2. Fetcher downloads HTML (or Playwright for JS)
3. Extractor parses HTML/JSON
   Output: { name, price, url, ... }
4. Normalizer extracts ammo metadata
   Output: { productId, caliber, grain, ... }
5. Writer upserts to DB
   - Product (by productId/hash)
   - Retailer (by website)
   - Price (new record)
```

## Database Schema

### Products (Canonical)
```sql
CREATE TABLE products (
  id VARCHAR PRIMARY KEY,        -- UPC or hash
  upc VARCHAR UNIQUE,
  name VARCHAR NOT NULL,
  caliber VARCHAR,
  grain_weight INTEGER,
  case_material VARCHAR,
  purpose VARCHAR,
  round_count INTEGER,
  category VARCHAR,
  brand VARCHAR,
  image_url VARCHAR,
  metadata_json JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Retailers
```sql
CREATE TABLE retailers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  website VARCHAR UNIQUE,
  tier VARCHAR,                  -- STANDARD, PREMIUM
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Prices (Time Series)
```sql
CREATE TABLE prices (
  id VARCHAR PRIMARY KEY,
  product_id VARCHAR REFERENCES products(id),
  retailer_id VARCHAR REFERENCES retailers(id),
  price DECIMAL NOT NULL,
  in_stock BOOLEAN,
  url VARCHAR,
  created_at TIMESTAMP
);

CREATE INDEX idx_prices_product ON prices(product_id, created_at DESC);
CREATE INDEX idx_prices_retailer ON prices(retailer_id, created_at DESC);
```

## API Endpoints (Future)

### Price Consolidation
```
GET /api/products/:id/prices
Response:
{
  product: { id, name, upc, caliber, grain, ... },
  prices: [
    { retailer: "PSA", price: 18.99, inStock: true, url: "..." },
    { retailer: "Brownells", price: 19.99, inStock: true, url: "..." },
    { retailer: "MidwayUSA", price: 17.49, inStock: false, url: "..." }
  ],
  cheapest: { retailer: "MidwayUSA", price: 17.49 },
  inStockCheapest: { retailer: "PSA", price: 18.99 }
}
```

### Historical Trends
```
GET /api/products/:id/history?days=30
Response:
{
  product: { id, name, ... },
  priceHistory: [
    { date: "2025-12-01", avgPrice: 18.50, minPrice: 17.49, maxPrice: 19.99 },
    { date: "2025-11-30", avgPrice: 19.00, minPrice: 18.99, maxPrice: 20.49 }
  ]
}
```

### Search with Filters
```
GET /api/products/search?caliber=9mm&grain=115&case=brass&purpose=target&inStock=true
Response:
{
  results: [
    {
      product: { id, name, upc, caliber, grain, ... },
      cheapestPrice: { retailer, price, url }
    }
  ],
  facets: {
    brands: { "Federal": 45, "Winchester": 32, ... },
    grains: { "115": 67, "124": 43, "147": 12 },
    caseMaterials: { "Brass": 89, "Steel": 23 }
  }
}
```

## Performance Optimizations

### Feed Processing
- **Hash-based caching**: Skip unchanged feeds (saves 70-90% processing)
- **Batch upserts**: Insert 1000s of products in single transaction
- **Parallel parsing**: Process multiple feeds concurrently

### Scraping
- **Rate limiting**: Respect robots.txt, add delays
- **IP rotation**: Avoid bans from aggressive scraping
- **Caching**: Store scraped HTML for debugging

### Database
- **Indexes**: On product UPC, caliber, grain for fast filtering
- **Partitioning**: Partition prices by date for historical queries
- **Materialized views**: Pre-compute "cheapest price" for each product

## Monitoring & Alerts

### Execution Monitoring
- Track success/failure rates per source
- Alert on consecutive failures
- Dashboard showing items harvested per day

### Data Quality
- Alert on products without UPC
- Alert on missing caliber/grain for known ammo brands
- Track normalization extraction rates

### Performance
- Average execution time per source
- Queue depth monitoring
- Redis memory usage

## Next Steps

### Immediate (Week 1)
1. ✅ Implement feed hash caching in fetcher (`apps/harvester/src/fetcher/index.ts`, `apps/harvester/src/utils/hash.ts`)
2. ✅ Add AvantLink parser (`apps/harvester/src/parsers/avantlink.ts`)
3. ✅ Add ShareASale parser (`apps/harvester/src/parsers/shareasale.ts`)
4. ✅ Update pipeline routing (feed vs scraper paths) (`apps/harvester/src/fetcher/index.ts`)

### Short-term (Week 2-3)
1. Add Playwright support for JS-rendered pages
2. Implement API endpoints for price consolidation
3. Build admin UI for managing sources
4. Add execution monitoring dashboard

### Medium-term (Month 2)
1. Add more affiliate networks (CJ, Rakuten)
2. Implement price history API
3. Add search with faceted filters
4. Set up price change alerts

### Long-term (Month 3+)
1. ML-based product matching (for products without UPC)
2. Automatic brand/caliber correction
3. Image analysis for verification
4. Predictive pricing models
