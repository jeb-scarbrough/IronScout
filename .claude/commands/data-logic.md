You are Codex running in this Prisma + Postgres + Next.js repository. Find esoteric data logic issues and generate automated tests to catch them without UI testing.

Focus areas:
- Time semantics: createdAt vs observedAt vs updatedAt; timezone conversions; ordering mistakes
- Corrections overlay: ignored runs excluded; correction precedence; append-only interpretation
- Visibility at query time: consistent application across Prisma + raw SQL
- Drift: raw SQL diverges from canonical Prisma helpers/predicates
- Truncation/limits: hard caps causing misleading “top N”
- Silent fallbacks: try/catch returning placeholder, fake metrics, Math.random
- Job idempotency: retries, double-processing, missing unique constraints, non-transactional writes
- Next.js caching: fetch cache/revalidate causing stale or inconsistent data

STEP 1 — Inventory entrypoints
- List app/api/**/route.ts, pages/api/**, server actions, cron/jobs/queues.
- Identify DB modules: prisma client init, repositories, services.

STEP 2 — Targeted searches (report file:line and snippet)
A) Prisma usage patterns:
- findMany/findFirst/upsert/transaction/groupBy/aggregate
- orderBy usage on timestamps
B) Raw SQL / escape hatches:
- prisma.$queryRaw, prisma.$executeRaw, SQL tagged templates, string interpolation
C) Corrections/ignored runs:
- ignoredAt, correction, override, multiplier, correction type enums
D) Visibility predicates:
- listingStatus/visibilityStatus/retailer eligibility; where clauses and joins
E) Limits/truncation:
- LIMIT, take:, cursor, pagination, slice, hardcoded caps
F) Placeholder/fake data:
- Math.random, mock, placeholder, demo, hardcoded metrics
G) Silent fallback:
- catch blocks returning [], {}, default objects; swallowing errors; “return null” without logging
H) Next caching:
- fetch cache options, revalidate, unstable_cache, cache()

STEP 3 — Issue cards
For each issue found output:
- Title
- Severity P0/P1/P2/P3
- Category (Logic/Integrity/Security/Misconfig/ADR)
- Evidence (file:line + snippet)
- Why it’s a problem (invariant violated)
- Exact fix recommendation (code-level)
- Test to add (file name + outline + fixture)

STEP 4 — Generate 10 invariant tests (no UI):
- 5 differential tests: canonical oracle vs each raw SQL callsite
- 5 property tests: generate sequences of price events + corrections and assert invariants

OUTPUT:
1) Entrypoint inventory
2) Issues sorted by severity
3) Suggested test file names and where to place them (e.g., __tests__/invariants/*.test.ts)
4) Verification checklist after fixes
Prefer high-confidence findings; if unsure, mark P2 with rationale.
