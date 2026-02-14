# Monitoring and Observability

This document defines the **minimum monitoring and observability requirements** for IronScout v1.

Its purpose is not to maximize metrics.  
Its purpose is to ensure the system can be **understood, debugged, and trusted** by a small team.

If behavior cannot be observed, it cannot be trusted.

---

## Observability Goals (v1)

Monitoring must allow operators to:

- Detect failures quickly
- Understand *what* failed and *where*
- Correlate user-facing issues with backend behavior
- Diagnose issues without modifying production code

v1 prioritizes **actionable signals over exhaustive telemetry**.

---

## Core Signals (Required)

The following signal categories are mandatory in v1.

### Application Health

Each deployed app must expose basic health signals:

- Process running
- Request success / error rates
- Latency at coarse granularity
- Crash or restart events

Applies to:
- `apps/api`
- `apps/web`
- `apps/merchant` (Merchant portal)
- `apps/admin`
- `apps/harvester`

If an app is unhealthy, operators must know quickly.

---

### API Observability

Required API signals:
- Request count by endpoint
- Error rate by endpoint
- Authentication and authorization failures
- Uniform capability shaping checks (no consumer tiers in v1)
- Retailer eligibility filter hits

These signals help answer:
- “Is the API up?”
- “Is enforcement working?”
- “Are users being incorrectly blocked or allowed?”

---

### Harvester Observability

Harvester is a trust-critical system and requires deeper visibility.

Required signals:
- Job counts (enqueued, processing, completed, failed)
- Execution status per source and affiliate feed
- SKIPPED execution counts and reasons
- Write counts (prices, inventory)
- Error summaries by stage (fetch, normalize, write)

Operators must be able to answer:
- “Is ingestion running?”
- “What failed?”
- “Did bad data propagate?”

---

### Queue Health (BullMQ / Redis)

Required queue-level signals:
- Queue depth
- Processing rate
- Failed job count
- Stalled jobs

Queue backlogs are early warning signals.

If queues are growing without draining, intervention is required.

---

## Logging

### Logging Principles

Logs must be:
- Structured where possible
- Correlated via request IDs or execution IDs
- Safe (no secrets or PII)

Logs exist to answer:
- What happened?
- When?
- To which entity?

---

### Required Log Context

Logs should include:
- Environment
- App name
- Request ID or execution ID
- Relevant entity IDs (user, merchant, feed, execution)

Harvester logs must include execution identifiers consistently.

---

## Alerting on Monitoring (Meta-Alerts)

Monitoring systems may generate alerts for operators.

Required alert categories:
- API unavailable or error rate spike
- Harvester stalled or failing consistently
- Queue backlog exceeding thresholds
- Database connectivity failures

Operator alerts must:
- Be actionable
- Avoid noise
- Trigger escalation only when necessary

Alert fatigue is a failure mode.

---

## Log Monitoring (v1)

### Architecture

Application logs flow through a centralized pipeline:

```
Render services → syslog → Grafana Alloy → Loki → Grafana → Slack
```

All Render-hosted services (API, Web, Admin, Merchant, Harvester) ship logs via syslog to a self-hosted Grafana Alloy instance, which forwards to Loki for storage and querying.

### Two Pillars

Log monitoring uses two complementary approaches:

1. **Continuous Grafana Alerts** (11 rules) — Threshold-based rules evaluated on a schedule. Fire to Slack when conditions are met. No operator intervention required for detection.
2. **On-demand `/check-logs` skill** — AI-powered log investigation via Claude Code. Queries all 22 LogQL patterns, compares to baseline, and produces a structured health report. Use for daily checks, incident triage, or alert follow-up.

### Alert Rules Summary

| # | Alertname | Severity | What It Catches |
|---|-----------|----------|-----------------|
| 1 | `ironscout-fatal-error` | critical | Any fatal-level log event |
| 2 | `ironscout-api-restart-storm` | critical | API restarted 3+ times in 10m |
| 3 | `ironscout-db-connectivity` | critical | Database connectivity failures (Prisma init, DNS, TCP, pool saturation) |
| 4 | `ironscout-harvester-restart-storm` | critical | Harvester restarted 3+ times in 10m |
| 5 | `ironscout-log-ingestion-stalled` | critical | Zero logs arriving in Loki (pipeline broken) |
| 6 | `ironscout-error-rate-spike` | warning | >20 errors in 5m sustained |
| 7 | `ironscout-prisma-errors` | warning | Sustained Prisma validation/request errors |
| 8 | `ironscout-ingest-run-failures` | warning | 3+ failed ingest runs in 30m |
| 9 | `ironscout-ingestion-stalled` | warning | Zero ingest summaries in 6h |
| 10 | `ironscout-redis-connectivity` | warning | Redis connectivity errors |
| W1 | `ironscout-watchdog` | warning | Dead man's switch (always firing; absence = broken alert pipeline) |

### Provisioning

Alert rules, contact points, notification policies, and message templates are provisioned via YAML files in:

```
infrastructure/grafana/provisioning/alerting/
```

Copy these files to the Grafana host's provisioning directory and restart Grafana to apply.

### Detection Layers

| Layer | What It Detects | Rules |
|-------|----------------|-------|
| Log pipeline health | Logs not arriving in Loki | #5 Log Ingestion Stalled |
| Alert pipeline health | Grafana cannot evaluate or deliver alerts | W1 Watchdog |
| Application health | Errors, crashes, connectivity, ingestion failures | #1-4, #6-10 |

If log pipeline fails (no logs in Loki), all application health rules silently evaluate against empty data and report OK. Rule #5 is the only signal that this is happening.

### Weekly Operator Checklist

Open the Grafana Alerting page and confirm no rules are in Error state. This catches Loki partial failures and datasource auth drift that don't trigger Slack notifications.

### Known Blind Spots

| Signal | Why It's Blind | Workaround |
|--------|---------------|------------|
| Payment failures | DB audit writes, not log events | Query `admin_audit_logs` table |
| Auth success rate | Plain messages without `event_name` | Regex pattern matching (may miss edge cases) |
| Queue backlog depth | BullMQ depth not in Loki | Check Bull Board manually |
| Degraded ingest runs | SUCCESS with low output not flagged | Review INGEST_RUN_SUMMARY fields via `/check-logs` |

### Full Spec

See `context/specs/log-monitoring-v1.md` for complete details including all LogQL expressions, runbooks, rationale, and verification steps.

---

## Tier and Eligibility Monitoring

Because eligibility is a trust boundary, it requires explicit observability.

Required checks:
- Count of results filtered due to ineligibility
- Count of alerts suppressed due to eligibility
- Attempts to access restricted features (if any) in v1
- Attempts by ineligible Retailers or quarantined feeds to ingest data

Unexpected spikes in these signals indicate bugs or abuse.

---

## AI and Search Observability

AI systems must remain explainable at a high level.

Required signals:
- AI-assisted search usage rate
- Embedding generation errors
- Explanation generation success/failure
- Fallback rates to non-AI behavior

Operators do not need internal model scores, but must see:
- when AI is used
- when it fails
- when it is disabled

---

## Dashboards (Minimal)

Dashboards should exist for:
- API health
- Harvester health
- Queue health
- Eligibility enforcement

Dashboards must be:
- Readable at a glance
- Focused on anomalies
- Not overloaded with metrics

If a dashboard cannot be understood quickly, it is too complex.

---

## Debugging Without Code Changes

A core requirement for v1:

Operators must be able to:
- Identify a failing feed
- Quarantine or disable it
- Inspect the last execution
- Prevent further propagation

All without:
- Editing production code
- Modifying the database manually

If this is not possible, observability is insufficient.

---

## Data Retention

Observability data should be retained long enough to:
- Debug issues
- Understand trends
- Audit incidents

Exact retention periods are flexible, but:
- Short retention that prevents root cause analysis is not acceptable

---

## Query Analytics Retention

`search_query_logs` and `price_check_query_logs` store internal product analytics (search patterns, caliber demand, zero-result queries).

- **Retention:** 1 year
- **Purge cadence:** Monthly job to delete rows older than 365 days (deferred to [GitHub issue #150](https://github.com/jeb-scarbrough/IronScout/issues/150); not required for v1)
- **DSAR:** `userId`, `userAgent`, `referrer`, `gunLockerCalibers` nullified on account deletion; rows preserved for aggregate analytics

---

## Non-Negotiables

- Trust-critical paths must be observable
- Silent failures are unacceptable
- Eligibility enforcement must be visible
- Operators must not rely on memory or guesswork

---

## Guiding Principle

> Observability is how the system explains itself to its operators.
