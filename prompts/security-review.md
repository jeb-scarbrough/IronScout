You are Codex operating inside the IronScout repository.

Mission
- Perform a deep, end-to-end security + correctness audit focused on preventing: (a) data leaks, (b) auth/tenant-boundary bypasses, (c) client/server trust mistakes, and (d) operational/logging exposure.
- Treat this as a “trust-critical launch gate” review: prioritize issues that could expose consumer/merchant/admin data or violate server-side enforcement invariants.

Non-negotiable context (read first, then enforce)
1) Read and follow: context/AGENTS.md (agent rules + invariants). :contentReference[oaicite:0]{index=0}
2) Read and follow: context/05_security_and_trust.md (trust boundaries + security model). :contentReference[oaicite:1]{index=1}
3) Read and follow: context/03_release_criteria.md (must-not-ship conditions). :contentReference[oaicite:2]{index=2}
4) Read and follow: ADR-002 (server-side enforcement) + ADR-009 (fail closed). :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}

Scope (scan all apps + shared packages)
- apps/api (Express API: auth, search, products, pricing, alerts, admin/ops endpoints)
- apps/web (consumer Next.js)
- apps/admin (admin portal)
- apps/dealer (merchant portal; may be legacy-named)
- apps/harvester (ingestion worker + schedulers)
- packages/* or libs/* (shared auth, db, logging, utils)
- Infrastructure config: env handling, secrets, CI, docker, deployment scripts, queue config

What to hunt for (exhaustive checklist)

A) Authentication, Authorization, and Tenant Isolation (highest priority)
- Any route that returns data without verifying identity where required.
- Any cross-tenant access path:
  - consumer ↔ consumer
  - merchant ↔ merchant
  - consumer ↔ merchant/admin data
  - admin impersonation that bypasses constraints
- Missing/incorrect authorization checks on:
  - merchant-scoped entities (retailers administered by merchant, feeds, benchmarks, audit logs)
  - admin actions (eligibility/listing changes, subscription/billing mutations, impersonation)
- Insecure direct object references (IDOR):
  - userId/merchantId/retailerId passed from client without server verification
- Role checks:
  - “admin” gating done in UI only (must be enforced server-side)
  - “merchant user has rights to retailer” missing in API handlers

B) Client/Server Trust & “Never Trust the Client” Violations
- Any endpoint that trusts client-provided headers/cookies/body for:
  - tier, eligibility, subscription, role, merchantId, retailerId, userId
  - visibility/listing/eligibility decisions
- Any “feature flag” or “mode” controlled by client input.
- Any sensitive logic done client-side (Next.js) that should be server authoritative.

C) Data Exposure / Leakage
- API responses that include:
  - secrets, tokens, API keys, affiliate creds
  - internal-only fields, confidence hints, ranking internals, debug state
  - PII beyond what the surface needs
- Over-broad serialization:
  - returning full Prisma models
  - “include: { ... }” pulling unrelated relations
  - logs/executions endpoints returning raw payloads containing secrets
- CORS misconfig, overly permissive cookies, missing SameSite/HttpOnly/Secure flags.
- SSR/Next.js data fetching that leaks server-only env vars into client bundles.

D) Logging, Observability, and Error Handling
- Sensitive data written to logs:
  - Authorization headers, cookies, session tokens, passwords
  - merchant feed URLs if they embed credentials
  - raw upstream payloads (affiliate feeds) that may contain PII or tracking tokens
- Error responses that leak internals:
  - stack traces, SQL/Prisma errors, env dumps
- “Debug endpoints” exposed without admin gating.
- Ensure “fail closed” behavior on ambiguous auth/eligibility/tier.

E) Ingestion/Harvester Safety (integrity + blast radius)
- Duplicate scheduler risk, double-ingestion, race conditions that can create duplicate writes or corrupt “current price” views.
- Any ingestion write path that:
  - updates/deletes immutable fact tables (prices/pricing_snapshots) instead of append-only semantics
  - omits provenance fields where required (ingestionRunType/Id, observedAt, sourceId, retailerId, etc.)
- Any ingestion pipeline that can write user-visible data for ineligible/unlisted retailers.
- Quarantine/disable behavior: verify it truly stops downstream effects (writes, alerts, surfacing).

F) Eligibility / Visibility / Enforcement Correctness (trust-critical)
- Verify consumer visibility is enforced at query time (not UI-only, not ingestion-only).
- Verify listing/eligibility predicate is applied consistently across:
  - search results
  - product detail views
  - dashboard
  - alerts evaluation
  - saved items/watchlist views
- Verify subscription status is NOT used as consumer visibility gate; ambiguous state fails closed.

G) Admin Impersonation Boundaries
- Confirm impersonation is:
  - explicit in session context
  - audited
  - not bypassing subscription enforcement
  - not bypassing retailer visibility rules

H) Web Security Basics (don’t skip)
- CSRF for state-changing routes (esp. admin/merchant portals).
- XSS vectors:
  - rendering untrusted HTML, markdown, or AI-generated strings
  - dangerouslySetInnerHTML usage
- SSRF:
  - user-controlled URLs fetched server-side (feeds, previews, webhooks)
- Injection:
  - SQL/Prisma raw queries, unsafe string concatenation
  - command injection in scripts
- Rate limiting / abuse control on auth + search endpoints (at least note gaps).

How to execute the scan (required methodology)
1) Create an “entrypoint map”:
   - enumerate all API routes and Next.js route handlers (apps/api/src/routes/*, apps/*/app/api/**)
   - list which are public vs require auth; record the auth middleware used
2) For each route, trace:
   - input validation (Zod/validators)
   - authn/authz checks
   - DB queries and included relations
   - response shaping/serialization (ensure minimal fields)
3) Grep for high-risk patterns:
   - “include:” with Prisma relations
   - “req.headers” tier/role inference
   - “process.env” usage in client components
   - “console.log” / logger.* with request bodies or headers
   - “dangerouslySetInnerHTML”
   - “eval”, “new Function”, shell execution
4) Identify “trust boundaries” and verify each has a server-side guard:
   - merchant boundary
   - admin boundary
   - consumer boundary
5) Validate “fail closed” behavior:
   - any unknown/ambiguous state → deny/restrict, not allow
6) Add or propose tests where gaps exist:
   - authorization regression tests (golden tests for “cannot see other tenant”)
   - output safety tests (internal fields stripped)
   - eligibility predicate tests end-to-end

Deliverables (format exactly)
Produce a SECURITY REVIEW report with:

1) Executive Summary
- Overall risk rating (High/Medium/Low)
- “Must fix before ship” count

2) Findings Table (sorted by severity)
For each finding:
- ID (e.g., SEC-001)
- Severity (Critical/High/Med/Low)
- Category (AuthZ, Data leak, Logging, XSS, SSRF, Ingestion, etc.)
- Affected component(s) + file paths + line numbers
- Repro steps (clear, deterministic)
- Impact (what data / boundary is violated)
- Root cause (1–2 sentences)
- Recommended fix (concrete)
- Suggested test to prevent regression

3) “No-Ship” Gate Check
Explicitly state whether any finding violates release criteria (must-not-ship conditions) and why. :contentReference[oaicite:5]{index=5}

4) Patch Proposals
For each Critical/High issue, propose code-level remediation:
- exact guard/middleware changes
- safer serialization DTOs
- logging redaction plan
- stricter input validation
- test additions

5) Residual Risks / Follow-ups
List anything that should be scheduled but doesn’t block v1.

Operating constraints
- Do not add new product features.
- Prefer removal or tightening over expansion.
- If docs conflict with code behavior, stop and report the conflict (do not guess). :contentReference[oaicite:6]{index=6}

Start now:
- Read the required context files.
- Then scan the repo following the methodology above.
- Output the SECURITY REVIEW report with the specified structure.
