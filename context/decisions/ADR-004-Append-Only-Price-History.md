
# ADR-004 Amendment: Clarification of Append-Only Price History

## Status
Accepted

## Purpose
Clarify the meaning of “append-only price history” and formally link ADR-004 to ADR-015, which defines correction, ignore, and current price semantics required for operational safety.

This amendment resolves ambiguity between historical immutability and real-world data quality remediation.

---

## Original Invariant (Unchanged)

ADR-004 establishes that **price history is append-only**:
- Price records are never UPDATEd or DELETEd.
- Historical facts are preserved for auditability.

This invariant remains correct and unchanged.

---

## Clarification: Append-Only ≠ Always Valid

Append-only storage **does not imply** that all historical price records are:
- correct,
- trustworthy,
- or safe for user-facing consumption.

Bad data may be ingested and discovered later.

Therefore:
- Append-only is a *storage invariant*.
- Visibility and correctness are *interpretation concerns*.

---

## Authoritative Interpretation Layer

ADR-015: *Price History Immutability, Corrections, and Operational Control* is now the **authoritative definition** of:

- What constitutes a *visible* price record
- How ignored runs affect history
- How corrections are applied
- How current price is derived
- How alerts behave under corrections

All user-facing pricing logic **MUST** conform to ADR-015.

ADR-004 alone is insufficient.

---

## Definition of “Valid Record”

Any reference in ADR-004 or downstream code to:
- “valid price”
- “most recent valid record”
- “current price”

Is hereby defined as:

> A **visible price event** as specified in ADR-015.

This includes:
- exclusion of ignored runs,
- application of IGNORE and MULTIPLIER corrections,
- observedAt-based time semantics,
- lookback window rules.

---

## Scope of Immutability

### Immutable
- `prices`
- `pricing_snapshots`

These are append-only fact tables.

### Mutable
- `products`
- `retailers`
- `source_products`
- `merchants`

These are dimension tables and may be upserted or enriched.

ADR-004 immutability applies **only** to price facts.

### Provenance vs Visibility (Separation)
- Provenance fields are required on price facts (ADR-015): `ingestionRunType`, `ingestionRunId`, `merchantId` (nullable on prices), `retailerId`, `sourceId`, `affiliateId` (nullable).
- SOURCE correction scope key is `prices.sourceId`; `sourceProductId` is secondary only if `sourceId` is unavailable.
- Visibility is governed by eligibility + listing + active relationship; subscription state is never a consumer visibility predicate.

---

## Operational Implication

Any system that:
- reads price history,
- derives current price,
- triggers alerts,
- computes benchmarks,

Must:
- read from derived “visible” data, or
- apply ADR-015 correction semantics.

Failing to do so violates ADR-004 as amended.

---

## Final Note

ADR-004 defines **what must never change**.
ADR-015 defines **how the system remains correct anyway**.

Both are required.
