# Design QA System

This folder defines the mandatory Design QA gate for IronScout.

Order of execution (non-negotiable):
A) Correctness / Flow / State
B) Identity + Language
C) Aesthetic Craft

Rules:
- A blocks everything.
- B blocks shipping.
- C never overrides A or B.

If a change fails this process, it does not ship.

## Enforcement

- Any A) Correctness / Flow / State BLOCKER blocks merge.
- Any B) Identity / Language BLOCKER blocks release.
- C) Aesthetic Craft findings never override A or B.
- “Design feedback” without this process is invalid.

This folder defines policy, not suggestions.
