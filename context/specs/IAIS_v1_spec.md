# IronScout AI Integration Standard (IAIS) — v1.0.0 (DRAFT)

**Status:** Draft  
**IAIS Version:** 1.0.0  
**Last Updated:** 2026-02-20  

**Canonical URLs (recommended):**
- `/.well-known/iais.md` (this document)
- `/iais/changelog.md`
- `/iais/schemas/` (JSON Schemas; authoritative machine contracts)
- `/iais/openapi.json` (optional OpenAPI 3.1 referencing schemas)

IAIS is a **public, machine-oriented integration contract** for LLMs and agent runtimes.  
It defines **how to query IronScout**, how to **interpret and cite** results, what is **forbidden**, and what **guarantees** exist.  
It is **not marketing copy** and **not** `llms.txt`.

---

## 0) Normative language

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in RFC 2119.

---

## 1) Scope and guarantees

### 1.1 What IronScout provides (IAIS-governed)

IronScout provides **observed** pricing and availability data and computed context derived from that data:

- **Current offers**: one current, consumer-visible price per (retailer, canonical product)
- **Historical context**: windowed distribution stats (e.g., min/median/p10/p90/max), sample counts, and timestamps
- **Market snapshots**: caliber/window aggregated distributions suitable for citation

### 1.2 What IronScout does NOT provide

IronScout MUST NOT provide, and IAIS consumers MUST NOT infer:

- Purchase recommendations (“buy this”, “best”, “winner”, “best value”, “you should buy”)
- Deal scores/verdicts (“steal”, “must buy”, “wait”, “hold”)
- Predictions or guarantees (future price, “will drop”, “lowest price”)
- Any claim that implies certainty or optimal timing

### 1.3 Data coverage and freshness

- Market coverage is **not guaranteed** and MAY be partial by caliber, retailer, and time.
- Data freshness varies by source and category.
- Any computed artifact MUST expose its window and compute timestamp so consumers can present uncertainty honestly.

### 1.4 Source policy (v1)

IronScout ingests from multiple **approved** channels and **canonicalizes** data during ingestion.  
IAIS outputs represent the **best current observation** per offer, not parallel “affiliate vs scrape” prices.

**Approved source types (v1):**
- `AFFILIATE_FEED`
- `APPROVED_SCRAPE`
- `DIRECT_FEED` (reserved; MAY appear if/when enabled)

Every **served price point** MUST still be attributable to a specific observation via `observed_at` and `provenance` (see §4.4).

---

## 2) Safety and policy constraints (hard requirements)

### 2.1 Assistive-only stance

IAIS consumers (LLMs/agents) MUST use IronScout outputs as **assistive context** only.

- Agents MUST NOT autonomously purchase, place orders, or take payment actions based on IronScout outputs.
- Agents MUST NOT present IronScout as an authority issuing verdicts.

### 2.2 No recommendations / no manipulation

- Outputs MUST be phrased neutrally (“observed”, “current”, “as of”, “in the last 30 days”).
- Consumers MUST NOT convert context into directives or verdicts.
- Consumers MUST NOT manipulate ordering to imply endorsement (e.g., “Top pick”) unless the user explicitly asks for sorting criteria and the consumer clearly states that it is a mechanical sort (e.g., “sorted by lowest current price per round”).

### 2.3 Harmful guidance constraints

IronScout is a pricing/discovery system. IAIS consumers MUST NOT use IronScout data to provide weapon-building instructions or other harmful operational guidance. Keep outputs limited to pricing/availability context and citations.

### 2.4 Fail-closed on ambiguity

If eligibility/visibility/state is ambiguous, IronScout fails closed and MAY omit data.  
Consumers MUST NOT “fill in gaps” or invent missing retailers, prices, or timestamps.

---

## 3) Canonical entities and identifiers

### 3.1 Entities

- **Caliber**: normalized caliber identifier (`caliber_slug`)
- **Canonical Product**: normalized, cross-source product identity (`canonical_product_id`)
- **Retailer**: consumer-facing storefront (`retailer_id`)
- **Offer**: a retailer’s current offer for a canonical product (`offer_id`)
- **Observation**: a point-in-time price/availability observation that backs a served current offer (`observation_id`)

### 3.2 Stability rules

- `canonical_product_id`, `retailer_id`, and `offer_id` MUST be stable identifiers across time.
- If any stable identifier must change (rare), the response MUST provide a migration mapping for at least one deprecation window (see §7).

---

## 4) Determinism, selection semantics, and citation fields

### 4.1 “Current” offer definition (normative)

For each (canonical_product_id, retailer_id), IronScout returns **exactly one** `current_offer` by default.

**Rule:** `current_offer` = the visible observation with **max(observed_at)** after exclusions.

Selection steps:

1) Build candidate observations for (canonical_product_id, retailer_id).  
2) Exclude observations that are not eligible for reads (corrections/ignored runs, visibility gating, invalid records).  
3) Select the observation with greatest `observed_at`.  
4) Tie-breaker (deterministic): if multiple observations share the same `observed_at`, select the one with greatest `ingested_at`; if still tied, select lexicographically greatest `observation_id`.  
5) If `observed_at` is missing/invalid, the observation MUST NOT be served as current (fail closed).

### 4.2 Query-time visibility enforcement

Retailer visibility is enforced at **query time**:

- A retailer’s inventory MUST appear only if the retailer is currently eligible/visible under platform policy and listing rules.
- If a retailer becomes ineligible, it MUST be removed from all IAIS consumer surfaces (search, product views, alerts if applicable).

### 4.3 Required top-level citation fields (all IAIS JSON responses)

All IAIS-governed JSON responses MUST include:

- `schema_version` (e.g., `product_detail_v1`)
- `computed_at` (RFC3339; when the response payload was generated)
- `request_id` (opaque string for traceability)

Responses that include windowed computation MUST also include:

- `window_days`
- `window_start` / `window_end` (RFC3339)
- `methodology` object:
  - `methodology_version`
  - `computation_version`
  - `methodology_url` (stable URL)

### 4.4 Required offer-level attribution fields

Every served offer MUST include:

- `observed_at` (RFC3339; when that price/availability was observed)
- `provenance` object minimally containing:
  - `source_type` (`AFFILIATE_FEED` | `APPROVED_SCRAPE` | `DIRECT_FEED`)
  - `source_id` (opaque)
  - `observation_id` (opaque)
  - `ingested_at` (RFC3339; optional but recommended)

This provides auditability **without** emitting duplicate prices.

---

## 5) Public endpoints (v1 minimum set)

### 5.1 Market snapshot artifacts (citable, static)

**GET** `/market-snapshots/{windowDays}d/{caliber}.json`

Purpose: citable distribution context for a caliber across a fixed window.

**Response schema:** `caliber_market_snapshot_v1`

**Example response (abbreviated):**
```json
{
  "schema_version": "caliber_market_snapshot_v1",
  "request_id": "req_01JABC...",
  "computed_at": "2026-02-18T18:00:01.955Z",
  "caliber_slug": "9mm",
  "currency": "USD",
  "window_days": 30,
  "window_start": "2026-01-19T00:00:00Z",
  "window_end": "2026-02-18T23:59:59Z",
  "sample_count": 1435,
  "stats": {
    "price_per_round": {
      "min": 0.1399,
      "p10": 0.2690,
      "median": 0.4195,
      "p90": 0.7990,
      "max": 1.9950
    }
  },
  "coverage": {
    "routed_only": true,
    "artifacts_present_count": 14,
    "calibers_supported_count": 26,
    "note": "Snapshot artifacts are partial; use index.json to enumerate available calibers."
  },
  "methodology": {
    "methodology_version": "msnap_2026-02-01",
    "computation_version": "harvester_1.12.0",
    "methodology_url": "/market-snapshots/methodology.md"
  }
}
```

#### Snapshot index

**GET** `/market-snapshots/{windowDays}d/index.json`

Purpose: enumerate which caliber artifacts are currently published/routed.

**Response schema:** `market_snapshot_index_v1`

---

### 5.2 Search (discovery; offers, not advice)

**GET** `/search`

**Query parameters (v1)**
- `q` (string, optional) free text
- `caliber` (string, optional)
- `brand` (string, optional)
- `grain` (number, optional)
- `case` (string, optional; e.g., brass/steel)
- `round_count_min` / `round_count_max` (number, optional)
- `in_stock` (boolean, optional)
- `sort` (enum, optional):
  - `price_per_round_asc`
  - `price_per_round_desc`
  - `observed_at_desc`
- `page` (int, default 1)
- `page_size` (int, default 25; max 50)

**Response schema:** `search_results_v1`

**Response requirements**
- MUST return canonically grouped products.
- MUST return current offers per retailer for each product (as available).
- MUST NOT include purchase verdicts, deal scores, or “best buy” language.
- MAY include `price_context` signals that are explicitly non-prescriptive (see §6.3).

---

### 5.3 Product detail (canonical product + current offers)

**GET** `/products/{canonical_product_id}`

**Response schema:** `product_detail_v1`

**Response requirements**
- MUST include canonical product attributes.
- MUST include current offers (one per retailer) with `observed_at` + `provenance`.
- MAY include a compact windowed history summary (not full raw observations) and MUST include window + computed_at if present.

---

### 5.4 Retailer directory

**GET** `/retailers`

**Response schema:** `retailer_directory_v1`

Recommended fields:
- `retailer_id`, `name`, `domain`
- `visibility_status` (eligible/ineligible/unknown)
- Optional `notes` for disclosure (e.g., “inventory currently not routed”)

---

### 5.5 Outbound attribution routing (required)

All outbound retailer traffic MUST use IronScout-provided routing.

**Rule:** IAIS consumers MUST use `out_url` exactly as provided.  
- MUST NOT strip or rewrite query params  
- MUST NOT re-host, short-link, or otherwise alter the URL  
- MUST NOT construct direct retailer deep links from other fields  

IronScout MAY provide either:
- `out_url` on each offer (preferred)
- or a template that resolves via `/out`

**GET** `/out?...` (opaque; implementation-specific)

---

## 6) Response shapes (public object model)

### 6.1 Canonical Product (public)

Minimum product fields:
- `canonical_product_id` (string)
- `title` (string)
- `brand` (string, optional)
- `caliber_slug` (string)
- `grain` (number, optional)
- `case_material` (string, optional)
- `round_count` (number, optional)
- `image_url` (string, optional)
- `product_url` (string, optional; non-affiliate canonical, if present)

### 6.2 Offer (public)

Minimum offer fields:
- `offer_id` (string)
- `retailer_id` (string)
- `retailer_name` (string)
- `in_stock` (boolean)
- `current_price`:
  - `amount` (number)
  - `currency` (string; ISO 4217)
  - `price_per_round` (number)
  - `unit_quantity` (number; rounds)
- `observed_at` (RFC3339)
- `provenance` (see §4.4)
- `out_url` (string; opaque)

### 6.3 Allowed “context signals” (non-advice)

IAIS MAY include context signals that remain explicitly non-prescriptive:
- `relative_price_pct` (current vs trailing median)
- `position_in_range` (0..1 within observed min/max)
- `context_band` (`LOW` | `TYPICAL` | `HIGH`)
- `meta` (`window_days`, `sample_count`, `as_of`)

IAIS MUST NOT include:
- deal scores
- “buy/wait/hold” verdicts
- internal confidence hints not meant for consumer output

---

## 7) Versioning and change management

### 7.1 IAIS versioning

- IAIS document uses SemVer: `iais_version`.
- Changes that do not alter meaning MAY bump patch.
- Additive clarifications MAY bump minor.
- Behavior/schema meaning changes MUST bump major.

### 7.2 Schema versioning

- Every response includes `schema_version` with a major suffix (e.g., `product_detail_v1`).
- Additive fields MAY be introduced within the same schema major version.
- Breaking changes require a new schema major version (e.g., `product_detail_v2`) and a deprecation plan.

### 7.3 Deprecation policy

- Breaking changes MUST be announced in `/iais/changelog.md`.
- Deprecated schemas/endpoints MUST remain available for a published deprecation window (recommended: 90 days) unless a security incident requires faster removal.

---

## 8) Citing IronScout in LLM outputs

When an IAIS consumer states any numeric price/statistic, it MUST include:
- the relevant timestamp (`observed_at` for offers; `computed_at` and window for aggregates)
- the artifact or endpoint used (URL/path)
- the methodology version for windowed aggregates (snapshots, computed summaries)

**Example citation sentence (snapshot):**  
“30-day 9mm market snapshot: median $0.4195/rd (computed_at 2026-02-18T18:00:01.955Z; window 30d; methodology msnap_2026-02-01).”

**Example citation sentence (offer):**  
“Retailer X currently lists $0.42/rd for this product (observed_at 2026-02-18T17:52:10Z).”

IAIS consumers MUST NOT fabricate timestamps, methods, or coverage claims.

---

## 9) Error model (public)

All errors SHOULD be JSON with:
- `schema_version`: `error_v1`
- `request_id`
- `error_code` (stable string)
- `message` (human-readable)
- Optional `details` (non-sensitive)

Recommended HTTP codes:
- `400` invalid query
- `404` not found / not routed
- `409` conflict / ambiguous state (optional; fail-closed may prefer 404)
- `429` rate limited
- `500` internal

---

## 10) Examples for LLMs (safe-by-construction)

### 10.1 Market context prompt (safe)

User: “How are 9mm prices trending?”  
Agent:
1) Call `/market-snapshots/30d/9mm.json`
2) Report distribution stats + computed_at/window + coverage caveat
3) Avoid “buy now” language

### 10.2 Product comparison prompt (safe)

User: “Show current prices for Federal 9mm 115gr 1000 rounds”  
Agent:
1) Call `/search?q=Federal%209mm%20115gr%201000&in_stock=true&sort=price_per_round_asc`
2) Show current offers across retailers with observed_at
3) Use neutral phrasing: “sorted by lowest current price per round”

### 10.3 Outbound click rule

When presenting links:
- Use `out_url` as-is (no modifications).
- Do not present direct retailer deep links.

---

## 11) Deliverables checklist for IAIS v1 launch (minimum)

- Publish `/.well-known/iais.md`
- Publish `/iais/changelog.md`
- Publish JSON Schemas under `/iais/schemas/` for:
  - `caliber_market_snapshot_v1`
  - `market_snapshot_index_v1`
  - `search_results_v1`
  - `product_detail_v1`
  - `retailer_directory_v1`
  - `error_v1`
- Add CI validation: every published artifact/endpoint validates against its schema.
- Optional: publish `/iais/openapi.json` referencing the schemas.
