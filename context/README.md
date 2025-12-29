# Context

This folder contains the **authoritative context for IronScout**.

“Context” means shared understanding: what we promise, what we ship, how the system works, and how it is operated. These documents exist to keep product, engineering, and operations aligned as the system evolves.

If something is unclear or contradictory, start here.

This folder is the single source of truth for how IronScout is defined and operated.

---

## How to Read This Folder

Documents in `context/` are organized by **authority and purpose**.

### Highest authority (read first)
These documents define constraints that everything else must obey, including **UX, copy, and feature behavior**:

1. `00_public_promises.md`  
   What IronScout promises externally. This is the ceiling for UI copy, marketing, and API behavior.

2. `02_v1_scope_and_cut_list.md`  
   What is in scope for v1 and what is explicitly out. Prevents scope creep.

3. `03_release_criteria.md`  
   Binary conditions for shipping. If these are not met, we do not release.

4. `06_ux_charter.md`  
   Language, UX, and interaction guardrails that all user-facing surfaces must follow.

If there is a conflict between documents, **higher-authority documents always win**.

---

## Who This Is For

- Product: use public promises, scope, and UX charter
- Engineering: use architecture, reference, and UX charter
- Operations: use operations, runbooks, and guides

---

## Folder Overview

### Top-level (`00_` – `06_`)
Business, product, and UX truth:
- Public promises
- Product definition
- Scope decisions
- Release gates
- Pricing and trust boundaries
- UX and language guardrails

These are enforced constraints, not aspirations.

---

### `architecture/`
How the system works internally:
- Data model
- Search and AI usage
- Ingestion and harvester behavior
- Subscriptions, alerts, and scaling limits

Architecture documents explain mechanics and constraints.  
They do **not** define user-facing promises.

---

### `apps/`
User-facing behavior by surface:
- Consumer
- Dealer
- Admin
- Harvester

These documents describe what each app shows, hides, and enforces.

---

### `operations/`
How IronScout is run:
- Deployment
- Environments
- Monitoring
- Failure modes
- Runbooks (incident response)
- Guides (operational how-tos and debugging)

This section is written for operators, including a solo operator under load.

---

### `reference/`
Contracts and conventions:
- API conventions
- Core types and schemas
- Feature flags and tiers
- Design system constraints
- Error semantics

Reference docs explain *how to interface with the system*, not how to use it as a product.

---

### `examples/`
Copy-pasteable examples:
- Dealer feeds
- API queries
- Webhook payloads
- Alert configurations
- Integration recipes

If something is meant to be copied or tested, it belongs here.

---

### `decisions/`
Architectural Decision Records (ADRs):
- Why key decisions were made
- Tradeoffs and constraints at the time
- Immutable history

ADRs prevent re-litigating settled decisions.

---

### `archive/`
Historical documents with **no authority**.  
Preserved for context only. Never referenced by active docs.

---

## Documentation Rules

- Numbering is **local to each folder**.
- Every document must have a clear job.
- Public-facing claims must never exceed enforced behavior.
- UX and copy changes must comply with `06_ux_charter.md` unless overridden by a newer ADR.
- If a document becomes outdated, it is archived, not edited in place.
- If you are unsure what is true, defer to higher-authority docs.

---

## Guiding Principle

> Context is how we avoid relying on memory.

These documents exist so future decisions are made with the same understanding as past ones.

For expectations around changes to this folder, see `CONTRIBUTING.md`.

For coding agents and automated tooling, see `AGENTS.md` at the repo root.
