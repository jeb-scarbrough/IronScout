# Search and AI

This document describes how search and AI are used in IronScout **as implemented today**, and where explicit decisions or code changes may be required to fully align with v1 goals and trust constraints.

This document does not define product promises. Those live in `context/00_public_promises.md`.

---

## Purpose of AI in IronScout

AI in IronScout exists to **reduce friction caused by messy data**, not to make decisions for users.

AI is used to:
- Interpret ambiguous search intent
- Normalize inconsistent listings
- Assist ranking and grouping
- Generate optional explanatory context

AI is **not** used to:
- Recommend purchases
- Predict prices
- Provide verdicts
- Assert certainty

If AI output cannot be constrained or explained safely, it must be removed or downgraded.

---

## Search Architecture (Current)

### Entry Points

- Consumer search originates in `apps/web`
- Requests are handled by `apps/api` search endpoints
- Dealer inventory and retailer inventory are unified at query time

### High-Level Flow

1. User submits a search query (text + filters)
2. API parses intent (AI-assisted)
3. Explicit filters are validated and applied
4. Canonical products are resolved
5. Offers are fetched and shaped by tier
6. Results are ranked and returned

---

## Intent Parsing

### What It Does

AI-assisted intent parsing is used to:
- Interpret free-text queries
- Extract ammo-relevant attributes (caliber, grain, casing, etc.)
- Resolve synonyms and inconsistent phrasing
- Fill gaps when users provide incomplete information

This allows users to search naturally without knowing exact terminology.

### What It Does Not Do

- It does not override explicit filters
- It does not guess missing constraints with high confidence
- It does not inject attributes that are not supported by data

If intent parsing fails or confidence is low, the system should:
- fall back to keyword-style behavior
- broaden results rather than hallucinate precision

---

## Canonical Product Grouping

### Purpose

Canonical grouping exists to:
- Group inconsistent listings into comparable products
- Enable like-for-like comparisons
- Reduce noise in search results

### Mechanism (Conceptual)

- AI and rules assist normalization
- Canonical attributes are stored explicitly
- Grouping must be deterministic once assigned

### Invariants

- Canonical grouping must be stable
- Grouping changes must be explainable for ops
- A product should not oscillate between groups without intervention

---

## Ranking and Result Shaping

### Ranking Inputs

Ranking may consider:
- Text relevance
- Attribute match quality
- Availability
- Price (relative, not absolute)
- Recency

Premium tiers may unlock:
- additional ranking signals
- more flexible sorting
- deeper history access

### Hard Constraints

- Ranking must never imply recommendation
- Ranking language must remain descriptive
- “Best” must always be contextual (“lowest price”, “most recent”, etc.)

---

## Tier-Based Shaping

### Free Users

- Limited history depth
- Fewer ranking and sorting options
- Basic explanations only

### Premium Users

- Deeper historical context
- Faster and more flexible alerts
- Additional filters and ranking options
- AI-assisted explanations where data quality allows

Tier shaping must occur:
- server-side
- before data reaches the client

UI hiding alone is insufficient.

---

## AI-Assisted Explanations

### Purpose

Explanations exist to:
- Help users understand *why* something appears the way it does
- Describe price context relative to recent history
- Explain grouping or ranking at a high level

### Constraints

AI explanations must:
- Be optional
- Be clearly framed as context
- Avoid prescriptive language
- Degrade gracefully when data is weak

Examples of acceptable language:
- “Compared to recent prices…”
- “Historically this item has been priced around…”

Unacceptable language:
- “You should buy now”
- “This is the best deal”
- “This price will not last”

---

## Embeddings and Vector Search

### Current State (Observed)

- Embedding generation and usage appear to live in `apps/api`
- Embeddings are used for:
  - semantic search
  - similarity grouping
  - ranking assistance

Harvester does **not** currently appear to generate embeddings as part of ingestion.

### Decision Point

There is a mismatch between:
- earlier documentation that described an “embedding queue”
- current implementation that appears API-centric

**Decision required:**
- Treat API-based embedding generation as the v1 reality, or
- Move embedding generation to harvester queues later and defer for v1

**Recommendation for v1**
- Keep embeddings API-centric
- Treat queued embedding generation as deferred work
- Update architecture docs accordingly

---

## Failure Modes and Safe Degradation

When AI systems fail or data is weak:

- Explanations should be hidden or simplified
- Results should broaden, not narrow
- Language should reflect uncertainty
- Defaults should favor transparency over precision

If safe degradation cannot be guaranteed, the feature must not be enabled.

---

## Observability and Debugging

To support trust and ops:

- AI decisions should be traceable at a high level
- Inputs and outputs should be inspectable (where feasible)
- Search behavior should be reproducible for a given query and dataset

Exact internal scores do not need to be exposed, but behavior must be explainable.

---

## Known Inconsistencies and Required Decisions

These items require explicit decisions or code review:

### 1. Identity and Tier Resolution in API
- Some API paths appear to trust headers for tier resolution
- This conflicts with server-side enforcement requirements

**Action**
- Resolve tier from verified auth only

---

### 2. Embedding Lifecycle Ownership
- Docs vs code disagree on whether embeddings are API- or harvester-owned

**Action**
- Declare one owner for v1 and document the other as deferred

---

### 3. Explanation Gating
- Ensure explanations are:
  - gated by tier
  - gated by data sufficiency
  - removable without breaking UX

**Action**
- Add explicit guards before explanation generation

---

### 4. Canonical Group Stability
- No documented mechanism for preventing oscillation

**Action**
- Define when canonical mappings are allowed to change
- Document operational overrides if needed

---

## Non-Negotiables

- AI output must never exceed data quality
- AI language must never imply advice
- All AI-assisted behavior must be removable without breaking core search

---

## Guiding Principle

> AI exists to make messy data legible, not to make decisions.
