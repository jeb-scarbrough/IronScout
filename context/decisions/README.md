# Architectural Decision Records (ADRs)

This folder contains **Architectural Decision Records** for IronScout.

ADRs capture **why a decision was made**, not just what the system looks like today.  
They exist to prevent re-litigating settled questions as the product evolves.

If a question has already been decided and documented here, it should not be reopened without a new ADR.

---

## What Belongs in an ADR

An ADR is required when a decision:

- Has long-term architectural impact
- Introduces constraints that are hard to reverse
- Trades off correctness, trust, or operability
- Changes how multiple systems interact
- Resolves ambiguity that would otherwise resurface

Examples:
- Why tier enforcement is server-side only
- Why ingestion scheduling is singleton in v1
- Why AI explanations are assistive and optional
- Why dealers do not receive pricing recommendations

If the decision affects trust boundaries, it **must** be documented.

---

## What Does *Not* Belong in an ADR

Do not write ADRs for:
- Temporary implementation details
- Bugs or fixes
- Minor refactors
- Obvious defaults with no meaningful tradeoff

ADRs are not change logs.

---

## ADR Lifecycle

1. **Proposed**
   - Decision under consideration
   - Alternatives evaluated
   - Tradeoffs documented

2. **Accepted**
   - Decision is final
   - System is built to this constraint

3. **Superseded**
   - A newer ADR replaces this one
   - Original ADR remains immutable

ADRs are never edited after acceptance.  
They are only superseded.

---

## ADR Naming and Numbering

ADRs use sequential numbering:

