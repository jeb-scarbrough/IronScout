# Harvester App

This document describes the **Harvester as an application surface** in IronScout v1.  
It focuses on responsibilities, boundaries, and operational behavior as they relate to other apps, not internal pipeline mechanics (those live in `architecture/03_ingestion_and_harvester.md`).

This document must remain aligned with:
- `context/02_v1_scope_and_cut_list.md`
- `context/03_release_criteria.md`
- `context/05_security_and_trust.md`
- `architecture/03_ingestion_and_harvester.md`
- `architecture/06_scaling_and_limits.md`

If Harvester behavior contradicts those documents, this document is wrong.

---

## Terminology (Canonical)

- **Merchant**: B2B portal account (subscription, billing, auth boundary). Merchant has users. Merchant submits merchant-scoped datasets (e.g., `pricing_snapshots`).
- **Retailer**: Consumer-facing storefront shown in search results. Consumer `prices` are keyed by `retailerId`. Retailers do not authenticate.
- **Source/Feed**: Technical origin of a consumer price record (affiliate, scraper, direct feed). Source is not Merchant.
- **Admin rights**: Merchant users are explicitly granted permissions per Retailer.
- **Legacy**: Any “dealer” wording or `DEALER_*` keys are legacy and must be migrated to “merchant” terminology.

## Purpose of the Harvester App

The Harvester app exists to:
- Ingest external data predictably
- Normalize inconsistent inputs into canonical forms
- Preserve historical price data
- Enforce eligibility and trust boundaries before data reaches users

The Harvester is **not** a product surface.  
It is an operational system whose correctness directly affects trust.

---

## Harvester Responsibilities (v1)

### Data Ingestion

Harvester is responsible for ingesting:
- Retailer and affiliate sources
- Merchant-submitted feeds that produce Retailer price data

Responsibilities include:
- Fetching external data
- Parsing and validating inputs
- Normalizing ammunition attributes
- Writing prices, availability, and inventory updates

Harvester must never:
- Fabricate data
- Infer missing values beyond normalization rules
- Override explicit eligibility decisions

---

### Normalization and Canonical Mapping

Harvester:
- Applies ammo-specific normalization rules
- Maps inputs to canonical products where possible
- Preserves raw inputs for traceability

Constraints:
- Normalization must be deterministic
- Mapping failures must be visible and actionable
- Silent remapping is not allowed

---

### Historical Data Preservation

Harvester is the primary writer of:
- Price history
- Availability changes

Invariants:
- Historical data must not be overwritten silently
- Corrections must create new records or be explicitly audited
- "Current price" is derived, not mutated

If data cannot be trusted, it must not be written.

---

## Eligibility and Visibility (Retailer-scoped)

Eligibility applies to **Retailer visibility**, not Merchant existence.

- **Merchants** authenticate and administer one or more Retailers.
- **Retailers** are the consumer-facing storefronts shown in search results.
- Consumer `prices` are keyed by `retailerId`.
- Merchant benchmarks (`pricing_snapshots`) are keyed by `merchantId`.

### What eligibility does
If a **Retailer is ineligible**, its consumer-facing price events are excluded from user-visible reads and from alert evaluation.

### What eligibility does not do
Eligibility does not delete data and does not disable a Merchant account. Merchant access to the portal is governed by Merchant subscription and account status.

### Feeds vs outputs
Merchants may configure or submit feeds, but ingestion outputs are:
- Consumer prices → `prices` (keyed by `retailerId`)
- Merchant-submitted benchmarks → `pricing_snapshots` (keyed by `merchantId`)

Any remaining `dealer-*` pipeline names or folders are legacy naming only and must not be interpreted as “dealer == storefront.”

---

## Scheduling and Execution

### Current Model

- Scheduling occurs within the Harvester process
- Jobs are orchestrated via BullMQ
- Execution records track outcomes and errors

### v1 Constraint

Harvester scheduling must be:
- Singleton, or
- Explicitly lock-protected

Running multiple schedulers without coordination is not permitted.

If scheduling cannot be made safe, Harvester must be deployed as a single scheduler instance.

---

## Observability and Control

Harvester must provide operators with:
- Execution status and timestamps
- Error summaries
- Item counts (processed, written, skipped)
- Ability to disable or quarantine sources

Harvester must not require:
- Direct database modification for routine recovery
- Code changes to stop bad data propagation

---

## Failure Handling

### Acceptable Failures

- Delayed ingestion
- Partial ingestion with clear error reporting
- SKIPPED executions due to eligibility

### Unacceptable Failures

- Duplicate ingestion due to scheduling errors
- Writing Retailer price data for ineligible retailers
- Silent data corruption
- Downstream effects from failed or skipped executions

If a failure cannot be contained, Harvester must fail closed.

---

## Operational Boundaries

Harvester:
- Does not expose user-facing APIs
- Does not contain UI logic
- Does not make business decisions

Harvester:
- Enforces rules defined elsewhere
- Produces inputs consumed by other apps
- Is subordinate to trust and scope constraints

---

## Known Constraints and Decisions (v1)

These are intentional:

- No real-time ingestion guarantees
- No auto-scaling schedulers
- No autonomous correction or remediation
- No ingestion-driven feature flags

If any of these appear, it is a scope violation.

---

## Non-Negotiables

- Eligibility enforcement before visibility
- Idempotent execution
- Append-only historical data
- Observable and reversible behavior

---

## Guiding Principle

> The Harvester exists to protect data integrity before it reaches users.
