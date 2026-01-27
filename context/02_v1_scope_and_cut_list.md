# v1 Scope and Cut List

This document defines **exactly what ships in v1** and what is **explicitly out of scope**.

Its purpose is to prevent scope creep, over-promising, and operational overload.  
If a feature is not listed as IN SCOPE, it must be treated as OUT OF SCOPE for v1.

This document has higher authority than roadmaps, ideas, or partially implemented code.

---

Terminology note:
- Merchant = portal account, billing, auth boundary.
- Retailer = consumer storefront, price visibility boundary.
- v1 uses affiliate feeds only. Merchant onboarding, retailer feed ingestion, and subscription billing are deferred to v1.1.
Where Merchant/Retailer terms appear, they describe the future model.

---

## v1 Definition

v1 is considered successful if IronScout:

- Delivers clear, trustworthy price context to consumers
- Makes AI-powered search meaningfully better than keyword-only alternatives
- Proves affiliate-feed ingestion as a reliable source for consumer search and alerts
- Is operable by a small team without constant manual intervention

v1 is **not** required to be feature-complete or optimized for scale.

---

## IN SCOPE (v1)

### Consumer Product

- AI-powered, intent-aware ammo search
- Canonical product grouping across retailers
- Current price and availability display
- Historical price context (uniform for all users)
- Basic price and availability alerts
- Watchlists
- Affiliate feeds are the only ingestion source in v1
- No consumer Premium in v1; all consumer capabilities are available to every user

---

### Admin & Operations

- Admin impersonation for support and troubleshooting
- Feed enable/disable and quarantine controls
- Deterministic Retailer visibility enforcement
- Operational dashboards and logs
- Manual recovery workflows (documented)

---

### Platform & Infrastructure

- Harvester-based affiliate ingestion pipeline
- Idempotent scheduling and job execution
- Batched database writes
- Retailer visibility enforcement at query time (predicate: eligibility + listing; no subscription gating)
- Conservative, enforced UI language
- Observability sufficient to debug issues without guesswork

---

## EXPLICITLY OUT OF SCOPE (v1)

These items must not be shipped, marketed, or implied in v1.

### Consumer Features (Out)

- Buy / Wait / Hold verdicts
- Guaranteed deal indicators
- Savings calculations or attribution
- “Pays for itself” messaging
- Predictive pricing or forecasting
- Gamification or achievements
- Community features or social proof

---

### Merchant Portal Features (Out)

- Pricing recommendations
- Automated repricing
- Usage-based billing UI
- Guaranteed traffic or click commitments
- Conversion analytics or attribution
- Merchant-to-Merchant comparisons framed as competition (legacy "dealer" phrasing is deprecated)
- Any feature implying pricing advice

---

### AI Capabilities (Out)

- Autonomous decision-making
- Personalized purchase recommendations
- Confidence scores presented as certainty
- Claims of optimality or correctness
- Agent-driven actions without human control

---

### Platform / Scale (Out)

- Enterprise or custom plans
- SLAs or uptime guarantees
- Real-time ingestion guarantees
- Multi-region deployments
- Self-serve Merchant onboarding without review

---

## DEFERRED (Documented but Not Shipped)

These may exist in docs, code, or experiments but must remain disabled or internal.

- Merchant portal (all features)
- Retailer/merchant feed ingestion (CSV/XML/JSON)
- Merchant subscription and billing workflows
- Stripe integration and productized billing flows (v1.1+)
- Merchant benchmarks and pricing_snapshots
- Merchant analytics and insights
- Usage-based Merchant billing
- Advanced alerting logic
- Confidence tiering and degradation models
- Deeper AI explanations tied to confidence scoring
- Design automation and review agents

Deferred items must not leak into public UI or copy.

---

## Scope Enforcement Rules

- Partial implementation does not change scope.
- Code behind flags is still out of scope unless enabled intentionally.
- Internal tooling does not imply external availability.
- If scope is unclear, default to **out of scope**.

---

## Change Control

Any change to this document requires:
- Explicit intent to expand or reduce v1
- Review against `00_public_promises.md`
- Confirmation that enforcement exists, not just design

---

## Guiding Principle

> v1 succeeds by being clear, trustworthy, and operable — not by being exhaustive.

