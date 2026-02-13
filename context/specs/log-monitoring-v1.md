# Log Monitoring v1

## Goal

Provide hybrid log monitoring for IronScout: continuous Grafana alerting for threshold-based incidents, and an on-demand Claude Code skill (`/check-logs`) for AI-powered log investigation.

## Non-Goals

- No application code changes (queries match what code already emits).
- No new log shipping infrastructure (Render → Alloy → Loki pipeline exists).
- No auto-remediation or automated incident response.
- No custom dashboards (use Grafana Explore for drill-down).
- No metrics-based monitoring (no Prometheus, no OpenTelemetry metrics pipeline).
- No new notification channels (Slack webhook is the sole channel in v1).

## Scope

Applies to:
- All Render-hosted services: API, Web, Admin, Merchant, Harvester.
- Logs shipped via syslog to Grafana Alloy → Loki.
- Slack notifications via existing `SLACK_DATAFEED_ALERTS_WEBHOOK_URL` webhook.

Does not apply to:
- Client-side errors or browser telemetry.
- Stripe webhook delivery monitoring (handled by Stripe dashboard).
- Database query performance (no slow query log pipeline yet).

## Decision References

- ADR-001 Harvester Scheduler Singleton
- ADR-009 Fail Closed on Ambiguity
- ADR-010 Routine Ops Without Code Changes
- `context/operations/02_monitoring_and_observability.md`

---

## Infrastructure

### Current State

| Component | Detail |
|-----------|--------|
| Grafana | Self-hosted, accessed via `GRAFANA_URL` env var (default: `http://10.10.9.28:3001`) |
| Auth | Service account token via `GRAFANA_SA_TOKEN` env var (Viewer role, `glsa_` prefix) |
| Loki datasource | Referenced by UID string, not numeric ID — avoids silent breakage after infra changes |
| Loki labels | `source="render"`, `detected_level`, `service_name="unknown_service"` (Alloy JSON extraction broken — being fixed separately) |
| Query method | `\|~` pattern matching on log body (not label filters) |
| Slack | `SLACK_DATAFEED_ALERTS_WEBHOOK_URL` (already in use by harvester notifications) |

### Log Emission Reality

Queries must match what the code **actually emits**, not aspirational constants. The `LOG_EVENTS` object in `api/src/config/logger.ts` defines constants, but only `LENS_EVAL` is used in production code.

| Signal | What's actually logged | Source file | Reliable |
|--------|----------------------|-------------|----------|
| API startup | `log.info('API server started', { port })` — plain message, no `event_name` | `api/src/index.ts:17` | Regex |
| HTTP requests | `event_name: 'http.request.end'` / `'http.request.error'` | `middleware/request-logger.ts:114,142` | Yes |
| Ingest summary | `event_name: 'INGEST_RUN_SUMMARY'` | `config/ingest-summary.ts:168` | Yes |
| Worker starts | `event_name: '*_WORKER_START'` | `embedding/worker.ts:154`, etc. | Yes |
| Harvester boot | `log.info('Scheduler settings loaded')` — exactly 1 per boot | `worker.ts:262` | Regex |
| Auth failures | `log.warn('Blocked credentials login attempt')`, `log.error('Signin error')` — plain messages | `routes/auth.ts:261,321` | Regex |
| Payment failures | DB audit via `logStripeSubscriptionChange('STRIPE_PAYMENT_FAILED')` to `admin_audit_logs` — **not a log event** | `routes/payments.ts:40,79,1150,1710` | N/A |
| Lens eval | `event_name: 'lens_eval.v1'` — only LOG_EVENTS constant actually used | `services/lens/telemetry.ts:292` | Yes |

### Known Blind Spots

| Signal | Why it's blind | Workaround |
|--------|---------------|------------|
| Payment failures | Tracked via DB audit writes to `admin_audit_logs`, not structured log events | Query: `SELECT * FROM admin_audit_logs WHERE action LIKE '%PAYMENT_FAILED%' ORDER BY "createdAt" DESC` |
| Auth login success/failure | Logged as plain messages without `event_name`; regex may miss edge cases | Pattern match on known message strings from `routes/auth.ts` |
| Queue backlog depth | BullMQ queue depth, stalled job count, and retry storms are not emitted as structured log events. Bull Board exposes this data at `/admin/queues` but it is not available in Loki. | Manual check via Bull Board (`pnpm bullboard:dev`), or SSH tunnel to production Bull Board instance. No log-based detection exists for queue backlog growing without draining. |
| Degraded ingest runs | `INGEST_RUN_SUMMARY` with `status: 'SUCCESS'` but abnormally low `pricesWritten` or high `quarantineRate` is not flagged by alerts. A run can succeed technically while producing poor output. | `/check-logs` can surface these via sample queries; manual review of `successRate` and `quarantineRate` fields in INGEST_RUN_SUMMARY log lines is required. |

---

## Part 1: Claude Code Skill (`/check-logs`)

### Skill Definition

```yaml
---
name: check-logs
description: On-demand log investigation via Grafana/Loki. Queries errors, warnings, pipeline health, restarts, and novel patterns. Use for daily health checks, incident triage, or alert follow-up.
---
```

### Usage

- `/check-logs` — last 24 hours (default)
- `/check-logs 1h` — last 1 hour
- `/check-logs 6h` — last 6 hours
- `/check-logs 3d` — last 3 days

### Configuration

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `GRAFANA_SA_TOKEN` | Yes | — | Service account token (Viewer role) |
| `GRAFANA_URL` | No | `http://10.10.9.28:3001` | Grafana base URL |
| `LOKI_DATASOURCE_UID` | No | `loki` | Loki datasource UID (string, not numeric ID) |

If `GRAFANA_SA_TOKEN` is missing, ask the user. Never store it in any file.

### Execution Order

1. **Validate** — Check `GRAFANA_SA_TOKEN`, confirm Grafana reachable. Resolve datasource UID by calling `GET /api/datasources/name/Loki`. If 404, fall back to `GET /api/datasources` and select the first datasource with `type == 'loki'`. Print the resolved UID for operator verification. If `LOKI_DATASOURCE_UID` is set but doesn't match, warn and use the resolved UID. This catches silent drift if the datasource is recreated.
2. **Count queries** — Run all `count_over_time` instant queries in parallel (fast).
3. **Sample queries** — For any category with count > 0, fetch log lines (limit 20).
4. **Baseline queries** — Run error/warning counts against preceding window (2x length) for novelty detection.
5. **Analyze** — Group, deduplicate, classify severity, detect [NEW]/[SPIKE]/[RECURRING] patterns.
6. **Assess coverage** — Count how many queries succeeded vs failed. If any queries failed, flag the report as partial observability (see Partial Query Degradation below).
7. **Report** — Structured output with summary table, findings by severity, pipeline health, blind spots, novel patterns, and coverage status.

### Partial Query Degradation

If any queries in steps 2–4 fail (Loki timeout, Grafana 5xx, malformed response), the skill must:

- Continue executing all remaining queries. Never abort the full run because one query failed.
- Track the count of succeeded vs total queries attempted.
- If any queries failed, prepend a **Partial Observability Warning** to the report header:

```
## Partial Observability Warning
X of Y queries failed. The following categories have degraded coverage:
- [list failed query IDs and names]
Findings below may be incomplete. Re-run after investigating Grafana/Loki health.
```

- Include the failed queries (with their error messages) in a dedicated section at the end of the report so operators can diagnose why they failed.
- The overall severity assessment must account for degraded coverage: if error-category queries (A1–A8) failed, the report cannot claim "OK" status — it should report "UNKNOWN (degraded coverage)" instead.

### Query Battery (5 categories, 22 queries)

Queries match actually emitted log patterns. Use `event_name` field predicates where reliable, regex fallback elsewhere. Multi-field matches use chained `|~` pipes (not single long regex) to avoid field-order/escaping brittleness.

All queries use `{source="render"}` as the stream selector, with one or more `|~` filters on the log body. The "LogQL Filters" column shows the filter chain appended after the selector. Some entries (D2, E2) are multi-filter chains — treat them as raw LogQL suffix. Do not wrap them in an additional `|~`.

#### A: Errors & Fatals (8 queries)

| ID | Name | LogQL Filters | Reliability |
|----|------|---------------|-------------|
| A1 | All errors | `"level":"error"` | Reliable (all loggers emit level) |
| A2 | All fatals | `"level":"fatal"` | Reliable |
| A3 | Uncaught exceptions | `uncaughtException\|Uncaught exception` | Regex on message |
| A4 | Unhandled rejections | `unhandledRejection\|Unhandled rejection` | Regex on message |
| A5 | DB errors | `"error_category":"db"` | Reliable (request-logger classifies) |
| A6 | External service errors | `"error_category":"external"` | Reliable |
| A7 | Timeout errors | `"error_category":"timeout"` | Reliable |
| A8 | Internal errors | `"error_category":"internal"` | Reliable |

#### B: Application Health (5 queries)

| ID | Name | LogQL Filters | Reliability |
|----|------|---------------|-------------|
| B1 | API starts | `API server started` | Regex on message (`index.ts:17`). Exactly 1 per API boot. |
| B2 | Harvester boots | `Scheduler settings loaded` | Regex on message (`worker.ts:262`). Exactly 1 per harvester boot. Do NOT match `WORKER_START` — a single healthy harvester boot emits 5+ WORKER_START events (embedding, resolver, currentprice, quarantine, scrape). |
| B3 | Prisma errors | `PrismaClient.*Error\|P2002\|P2025` | Regex on error strings |
| B4 | Connection errors | `ECONNREFUSED\|ECONNRESET\|ETIMEDOUT` | Regex on error strings |
| B5 | Redis errors | `MaxRetriesPerRequestError\|redis.*NOAUTH\|READONLY.*redis\|MaxRetriesPerRequest\|Redis connection\|Connection is closed` | Regex on error strings. Covers: max retries exhausted, auth failures, read-only replica errors, generic connection failures, and closed connection errors. |

#### C: Harvester Pipeline (5 queries)

| ID | Name | LogQL Filters | Reliability |
|----|------|---------------|-------------|
| C1 | All ingest summaries | `INGEST_RUN_SUMMARY` | Reliable (`event_name` field, `ingest-summary.ts:168`) |
| C2 | Failed ingest runs | `INGEST_RUN_SUMMARY.*"status":"FAILED"` | Reliable (status enum: `SUCCESS\|WARNING\|FAILED`, covers both AFFILIATE and RETAILER pipelines) |
| C3 | Circuit breakers | `circuit.*breaker\|CIRCUIT_BREAKER` | Regex on message |
| C4 | Feed auto-disabled | `auto.*disabled\|AUTO_DISABLED` | Regex on message |
| C5 | Embedding errors | `EMBEDDING_JOB_FAILED\|EMBEDDING_WORKER_ERROR` | Reliable (`event_name` field) |

**Pipeline note**: In v1, AFFILIATE is the primary production pipeline. RETAILER summaries may be absent depending on deployment configuration. Absence of RETAILER summaries alone is not a failure signal.

#### D: Security & Auth (2 queries)

Matches actual log emissions, not unused `LOG_EVENTS` constants.

| ID | Name | LogQL Filters | Reliability |
|----|------|---------------|-------------|
| D1 | Auth errors/warnings | `Signin error\|OAuth signin error\|Blocked credentials login\|OAuth.*failed` | Regex on actual `auth.ts` messages |
| D2 | HTTP 4xx auth routes | (see below) | Reliable (request-logger). Chained pipes — each filter is independent of JSON field order. |

D2 filter chain (append after `{source="render"}`):
```
|~ "http.request.end" |~ "/api/auth" |~ "status_code.*4[0-9]"
```

#### E: Warnings (2 queries, sampled only)

| ID | Name | LogQL Filters | Reliability |
|----|------|---------------|-------------|
| E1 | All warnings | `"level":"warn"` | Reliable |
| E2 | HTTP 5xx | (see below) | Reliable (request-logger). Chained pipes for field-order safety. |

E2 filter chain (append after `{source="render"}`):
```
|~ "http.request.end" |~ "status_code.*5[0-9]"
```

### curl Templates

**Platform note**: On MINGW/Git Bash (current env), use `$(( $(date -u +%s) ))` for Unix timestamps. The `queries.md` file includes both bash and PowerShell equivalents for portability.

Count query (instant):
```bash
GRAFANA_URL="${GRAFANA_URL:-http://10.10.9.28:3001}"
LOKI_UID="${LOKI_DATASOURCE_UID:-loki}"
curl -s -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query" \
  --data-urlencode 'query=count_over_time({source="render"} |~ "\"level\":\"error\""[24h])' \
  --data-urlencode "time=$(( $(date -u +%s) ))" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN" \
  -o /tmp/loki_result.json
```

Sample query (range):
```bash
curl -s -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query_range" \
  --data-urlencode 'query={source="render"} |~ "\"level\":\"error\""' \
  --data-urlencode "start=$(( $(date -u +%s) - 86400 ))000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  --data-urlencode "limit=20" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN" \
  -o /tmp/loki_result.json
```

### Severity Classification

| Level | Conditions |
|-------|------------|
| CRITICAL | Any fatal, uncaught exception, unhandled rejection, DB connectivity failure (sustained), or 0 ingest summaries in 6h+ |
| WARNING | Error count > 10, any failed ingest run, error spike (3x baseline) |
| INFO | Server restarts, rate limiting, low-count recurring errors |
| OK | Counts within normal range, no novel patterns |
| UNKNOWN | One or more error-category queries (A1–A8) failed; coverage is degraded |

### Novelty Detection

Compare current window counts to preceding baseline window (2x length):
- **[NEW]**: Pattern present now, absent in baseline.
- **[SPIKE]**: Count >= 3x baseline.
- **[RECURRING]**: Present in both at similar rates.

### Report Template

```
# Log Health Report
**Window**: [start] to [end] ([duration])
**Coverage**: X/Y queries succeeded [FULL | PARTIAL]

## Partial Observability Warning (if applicable)
X of Y queries failed. Degraded categories: [list].
Findings below may be incomplete.

## Summary
| Category | Count | Status |
|----------|-------|--------|
| Fatal | 0 | OK |
| Errors | 12 | WARNING |
| ... | ... | ... |

## Overall: [CRITICAL/WARNING/OK/UNKNOWN]

## CRITICAL Findings
### [title] [NEW|SPIKE|RECURRING]
- **Count**: N
- **Category**: [error_category]
- **Examples**: (3 most recent, truncated)
- **Loki query**: `{source="render"} |~ "..."`

## WARNING Findings
...

## Pipeline Health
- Last AFFILIATE ingest: [timestamp] ([status])
- Last RETAILER ingest: [timestamp] ([status]) (may be absent in v1)
- Failed runs: N
- Circuit breakers: N
- Queue backlog indicator: [if Redis errors (B5) > 0 AND ingest summaries (C1)
  dropped vs baseline → "Possible queue backlog — check Bull Board for stalled
  jobs after Redis recovery"]

## Blind Spots (signals not in logs)
- Payment failures: tracked via DB audit writes to `admin_audit_logs` table.
  Query: SELECT * FROM admin_audit_logs WHERE action LIKE '%PAYMENT_FAILED%'
  ORDER BY "createdAt" DESC
- Auth login success/failure: logged as plain messages without event_name;
  pattern matching may miss edge cases.
- Queue backlog: BullMQ depth/stalled jobs not available in Loki.
  Check Bull Board manually.
- Degraded ingest runs: SUCCESS with low pricesWritten or high quarantineRate
  is not flagged. Review INGEST_RUN_SUMMARY fields manually.

## Novel Patterns
- [pattern] (N occurrences) [NEW]

## Failed Queries (if any)
| Query ID | Name | Error |
|----------|------|-------|
| ... | ... | ... |
```

### Hard Constraints

- Never suggest code changes (diagnostics only).
- Never expose credentials or PII from log lines.
- Truncate stack traces to 3 lines.
- If Grafana unreachable, report error and stop.
- If a query fails, note it and continue with remaining queries.
- Include raw Loki query for each finding so operator can drill down in Grafana UI.

---

## Part 2: Grafana Alert Rules

### Contact Point

Slack webhook contact point using Grafana's env var interpolation: `${SLACK_DATAFEED_ALERTS_WEBHOOK_URL}`. Must be set on the Grafana host.

### Notification Policy

| Severity | group_wait | group_interval | repeat_interval |
|----------|-----------|----------------|-----------------|
| critical | 10s | 1m | 1h |
| warning | 30s | 5m | 4h |

Group by `alertname` + `severity` to prevent duplicate noise.

### Alert Rules: 10 active rules (2 groups) + 1 watchdog = 11 total

**Canonical alertnames** (for provisioning drift detection — verify all 11 appear in Grafana UI after deploy):

`ironscout-fatal-error`, `ironscout-api-restart-storm`, `ironscout-db-connectivity`, `ironscout-harvester-restart-storm`, `ironscout-log-ingestion-stalled`, `ironscout-error-rate-spike`, `ironscout-prisma-errors`, `ironscout-ingest-run-failures`, `ironscout-ingestion-stalled`, `ironscout-redis-connectivity`, `ironscout-watchdog`

#### Group: IronScout Critical (eval interval: 1m, 5 rules)

Expressions below are literal LogQL — paste-safe for YAML provisioning. No markdown escaping inside code spans.

| # | Alert | For | noDataState | execErrState |
|---|-------|-----|-------------|--------------|
| 1 | Fatal Error | 0s | OK | Error |
| 2 | API Restart Storm | 0s | OK | Error |
| 3 | DB Connectivity | 2m | OK | Error |
| 4 | Harvester Restart Storm | 0s | OK | Error |
| 5 | Log Ingestion Stalled | 5m | **Alerting** | **Alerting** |

```yaml
# Rule 1: Fatal Error
expr: count_over_time({source="render"} |~ "\"level\":\"fatal\""[5m]) > 0

# Rule 2: API Restart Storm
expr: count_over_time({source="render"} |~ "API server started"[10m]) >= 3

# Rule 3: DB Connectivity
expr: count_over_time({source="render"} |~ "PrismaClientInitializationError|Can.t reach database|ECONNREFUSED|ENOTFOUND|Connection terminated|remaining connection slots|too many clients"[5m]) > 0

# Rule 4: Harvester Restart Storm
expr: count_over_time({source="render"} |~ "Scheduler settings loaded"[10m]) >= 3

# Rule 5: Log Ingestion Stalled
expr: count_over_time({source="render"}[10m]) == 0
```

**Rule 2 rationale**: Only matches `API server started` (`index.ts:17`) — exactly 1 event per API boot. Does NOT match `WORKER_START` because a single healthy harvester boot emits 5+ WORKER_START events (`worker.ts:262-300`): EMBEDDING_WORKER_START, CURRENT_PRICE_WORKER_START, QUARANTINE_REPROCESS_WORKER_START, RESOLVER_WORKER_START, plus "Affiliate feed worker started".

**Rule 4 rationale**: Mirrors rule 2 for the harvester. Matches `Scheduler settings loaded` (`worker.ts:262`) — exactly 1 event per harvester boot. Harvester restart loops are operationally critical because: (a) the scheduler singleton invariant (ADR-001) can be violated if two instances overlap during rapid restarts, (b) in-flight BullMQ jobs are abandoned on each restart, causing stalled job accumulation, (c) database connection pool churn during restart storms can degrade API performance via shared PostgreSQL. The Ingestion Stalled rule (rule 8) catches prolonged harvester downtime but not rapid crash-restart cycles where the process repeatedly boots and dies within minutes.

**Rule 3 rationale — broadened pattern**: Matches Prisma initialization failures, DNS resolution failures (`ENOTFOUND`), TCP connection failures (`ECONNREFUSED`), mid-query disconnects (`Connection terminated`), and connection pool saturation (`remaining connection slots`, `too many clients`). Pool saturation is a classic "everything's about to fail" leading indicator.

**Rule 5 rationale — Log Ingestion Stalled**: This is distinct from the Watchdog (W1). The Watchdog tests the Grafana → Slack pipeline: "can Grafana evaluate rules and deliver notifications?" Log Ingestion Stalled tests the Render → Alloy → Loki pipeline: "are application logs actually arriving in Loki?" A healthy Watchdog with zero log ingestion means Grafana alerting works but has nothing to alert on — every threshold rule silently evaluates against empty data and reports OK. This rule closes that gap. It uses `noDataState: Alerting` because no data from this query literally means the pipeline is broken. Expr: `count_over_time({source="render"}[10m]) == 0` — counts all logs, not filtered by level or pattern. If Render is emitting logs but Alloy is not forwarding them, this fires.

#### Group: IronScout Warning (eval interval: 2m, 5 rules)

| # | Alert | For | noDataState | execErrState |
|---|-------|-----|-------------|--------------|
| 6 | Error Rate Spike | 5m | OK | Error |
| 7 | Prisma Errors | 5m | OK | Error |
| 8 | Ingest Run Failures | 5m | OK | Error |
| 9 | Ingestion Stalled | 30m | OK | Error |
| 10 | Redis Connectivity | 3m | OK | Error |

```yaml
# Rule 6: Error Rate Spike
expr: count_over_time({source="render"} |~ "\"level\":\"error\""[5m]) > 20

# Rule 7: Prisma Errors
expr: count_over_time({source="render"} |~ "PrismaClientValidationError|PrismaClientKnownRequestError"[5m]) >= 5

# Rule 8: Ingest Run Failures
expr: count_over_time({source="render"} |~ "INGEST_RUN_SUMMARY" |~ "\"status\":\"FAILED\""[30m]) >= 3

# Rule 9: Ingestion Stalled
expr: count_over_time({source="render"} |~ "INGEST_RUN_SUMMARY"[6h]) == 0

# Rule 10: Redis Connectivity
expr: count_over_time({source="render"} |~ "MaxRetriesPerRequestError|ECONNREFUSED.*6379|redis.*NOAUTH|READONLY.*redis|Connection is closed"[5m]) > 0
```

**Rule 6 rationale — catastrophic-only, static threshold**: This rule is calibrated for major incidents only (>20 errors in 5 minutes, sustained for 5 minutes). Moderate error rate increases (e.g., 10 errors/5m sustained) will not trigger this alert. Use `/check-logs 1h` for faster detection of minor degradation. The static threshold is intentionally high to avoid alert fatigue during v1 baseline establishment. Calibrated against observed production baselines (12 errors/24h during launch testing). A static threshold has known limitations: it cannot distinguish a genuine spike from a new baseline after adding services or increasing traffic. See "Future: Relative Error Spike Detection" for the planned improvement.

**Rule 7 rationale**: Demoted from critical. Single-hit validation errors are code bugs, not infra P0. Only alerts on sustained rate indicating systemic issue.

**Rule 8 rationale**: Circuit breaker and auto-disable Slack notifications only cover the AFFILIATE pipeline (`affiliate/worker.ts`). RETAILER pipeline FAILED runs (`ingest-summary.ts:21,23`) have no other Slack notification path — this alert is the only coverage for retailer ingest failures.

**Rule 9 rationale — ingestion presence vs freshness vs quality**: This rule detects **presence**: are runs happening at all? It fires when zero `INGEST_RUN_SUMMARY` events appear in 6h. Widened from 2h to 6h with 30m `for` duration because the scheduler is intentionally toggleable (`env.md` harvester section). 6h window avoids false-paging during maintenance. Also covers harvester crash loops where the process never gets far enough to emit a summary. Operators should create a Grafana silence when planning extended maintenance. Worst-case detection latency: ~6h30m (6h window + 30m pending duration). This is a slow-burn alert by design. Use `/check-logs 1h` for faster freshness verification during active incident triage.

What this rule does NOT detect:
- **Runs failing**: Covered by rule 8 (Ingest Run Failures). Runs are happening but producing FAILED status.
- **Runs degraded**: Runs succeed (`status: 'SUCCESS'`) but with abnormally low `pricesWritten`, high `quarantineRate`, or zero `matched`. This is a known blind spot — INGEST_RUN_SUMMARY includes these fields but no alert rule evaluates them. The `/check-logs` skill can surface degraded runs via sample queries, but continuous alerting on quality metrics would require either application-code changes (emitting a separate quality alert event) or Loki metric queries against structured fields (fragile with current `|~` approach). Deferred to v2.

**Rule 10 rationale — Redis and queue health**: This rule detects Redis connectivity failures via log patterns. It covers: max retries exhausted (`MaxRetriesPerRequestError`), connection refused, authentication failures (`NOAUTH`), read-only replica errors, and closed connection errors (`Connection is closed`). What it does NOT cover: queue backlog growth, stalled job accumulation, and job retry storms. BullMQ does not emit structured log events for queue depth or retry counts. Queue health monitoring requires either Bull Board (manual) or a future metrics exporter. See Known Blind Spots. **Procedural response**: When this rule fires and Redis recovers, operators must check BullMQ queues via Bull Board for stalled/waiting backlog that accumulated during the outage.

#### Watchdog (separate group, eval interval: 5m)

| # | Alert | noDataState | execErrState | Behavior |
|---|-------|-------------|--------------|----------|
| W1 | Monitoring Heartbeat | **Alerting** | **Alerting** | Dead man's switch. Always-firing query (`vector(1)`). If Slack stops receiving this periodic heartbeat, either Grafana cannot evaluate rules or cannot **attempt** delivery to Slack. The watchdog does not confirm Slack actually displays messages (e.g., webhook silently rate-limited). Operators must periodically confirm heartbeat arrival manually. Unlike all other rules, this uses `Alerting` for both noData and execErr — a silent watchdog defeats its purpose. |

### Detection Layer Summary

The alert rules form three detection layers, each covering a different failure mode:

| Layer | What it detects | Rules |
|-------|----------------|-------|
| Log pipeline health | Logs not arriving in Loki (Render → Alloy → Loki broken) | #5 Log Ingestion Stalled |
| Alert pipeline health | Grafana cannot evaluate rules or attempt Slack delivery | W1 Monitoring Heartbeat |
| Application health | Errors, crashes, connectivity, ingestion failures within running services | #1–4, #6–10 |
| Slack delivery confirmation | Slack webhook silently fails (rate limit, revoked) | Not detected automatically; must manually verify heartbeat arrival |

If layer 1 fails (no logs in Loki), all application health rules (#1–4, #6–10) silently evaluate against empty data and report OK. Rule #5 is the only signal that this is happening.

### noDataState / execErrState Policy

| Rule type | noDataState | execErrState | Notification path |
|-----------|-------------|--------------|-------------------|
| Threshold rules (#1–4, #6–10) | **OK** — absence of matching logs = healthy | **Error** — enters error state in Grafana UI, visible on alert list page | Operators check Grafana alert list for rules in Error state |
| Log Ingestion Stalled (#5) | **Alerting** — no data literally means no logs arriving | **Alerting** — query failure also means pipeline is broken | Fires to Slack. Absence of logs is the failure condition. |
| Watchdog (W1) | **Alerting** — silence = broken pipeline | **Alerting** — query failure = broken pipeline | Fires to Slack. If no heartbeat arrives, investigate Grafana/Loki health |

If a threshold rule's query fails (Loki down, timeout), the rule shows "Error" in Grafana UI but does NOT fire a Slack notification (avoids noise from transient Loki blips). The watchdog's heartbeat absence is the signal that the alert pipeline is broken. The Log Ingestion Stalled rule's `Alerting` noDataState is the signal that the log pipeline is broken.

### Alert Annotations (Runbook Standard)

Every alert includes structured annotations:

```yaml
annotations:
  summary: "[one-line description]"
  description: "[what this means and user impact]"
  owner: "ops"
  dashboard_url: "${GRAFANA_URL}/explore?..."
  runbook: |
    1. [First triage step]
    2. [Second step]
    3. [Third step]
    Escalation: [when to escalate and to whom]
```

### Alert Runbooks

Concrete first-response steps for each alert. These are embedded in the `annotations.runbook` field of each provisioned rule.

| Rule | Runbook |
|------|---------|
| #1 Fatal Error | 1. Check Grafana Explore for the fatal log line — identify service and stack trace. 2. Check if service restarted (correlate with B1/B2 restart events). 3. Escalation: if fatal persists after restart, page on-call. |
| #2 API Restart Storm | 1. Check Render dashboard for API service deploy or crash events. 2. Check Grafana for error logs immediately before each restart. 3. Escalation: if crash-looping with no deploy, check for OOM or unhandled exception. |
| #3 DB Connectivity | 1. Check Render PostgreSQL dashboard for status/maintenance. 2. Check for `remaining connection slots` or `too many clients` (pool saturation). 3. Restart API only after DB confirmed healthy; if DB is healthy, check for connection leak in recent deploys. |
| #4 Harvester Restart Storm | 1. Check Render dashboard for harvester service crashes. 2. Check for Redis/DB connectivity errors preceding each restart. 3. Escalation: disable scheduler via Admin UI > Settings > Danger Zone > toggle "Main Harvester Scheduler" to Disable (sets `HARVESTER_SCHEDULER_ENABLED` to false in `system_settings` table via `danger-zone-settings.tsx`; stops new job scheduling on next poll but does not clear queues or stop in-flight jobs) to prevent ADR-001 scheduler overlap violations. |
| #5 Log Ingestion Stalled | 1. SSH to logging host (see ops inventory: `10.10.9.28`, the same host running Grafana/Alloy/Loki) — check Alloy process status (`systemctl status alloy`) and syslog receiver. 2. Check Loki health endpoint (`http://10.10.9.28:3100/ready`, `/metrics`). 3. Check Render syslog drain configuration for changes (Render Dashboard > Environment > Syslog Drain). |
| #6 Error Rate Spike | 1. Check Grafana Explore — filter by `"level":"error"` and group by error message. 2. Identify if errors are from one service or spread across all. 3. Escalation: if localized, check recent deploys to that service. |
| #7 Prisma Errors | 1. Check error messages — ValidationError = code bug; KnownRequestError = data/constraint issue. 2. Correlate with recent deploys. 3. Escalation: if sustained and not deploy-related, check for schema drift. |
| #8 Ingest Run Failures | 1. Check INGEST_RUN_SUMMARY logs for pipeline (AFFILIATE vs RETAILER) and error codes. 2. For AFFILIATE: check if circuit breaker fired or feed was auto-disabled. 3. Escalation: if multiple feeds failing, check upstream source availability. |
| #9 Ingestion Stalled | 1. Check harvester service status on Render (running? restarting?). 2. Check if scheduler is intentionally disabled via Admin Settings. 3. If unintentional: check Redis connectivity and BullMQ queue status via Bull Board. |
| #10 Redis Connectivity | 1. Check Render Redis dashboard for status/maintenance. 2. After Redis recovers: check BullMQ queues via Bull Board for stalled/waiting backlog. 3. Escalation: if Redis is healthy, check for NOAUTH (credential rotation) or READONLY (failover). |
| W1 Watchdog Missing | 1. Check Grafana service is running and alert evaluation is not paused. 2. Test Slack contact point manually (Alerting > Contact points > Test). 3. Check Grafana server logs for delivery errors. |

### Message Templates

Slack messages include: `[FIRING/RESOLVED]`, alert name, severity, summary, description, runbook steps (first 3), owner, dashboard URL, and timestamps.

### Maintenance Windows

When intentionally disabling the scheduler or performing extended maintenance, create a Grafana silence for the `ironscout-ingestion-stalled` alert:

Alerting > Silences > New Silence > matcher: `alertname=Ingestion Stalled`

### Notification Channel Limitations

Slack is the sole notification channel in v1. This is a single point of failure: if the Slack webhook URL expires, the workspace has an outage, or Slack rate-limits the webhook, all alert notifications are silently lost.

Mitigations in v1 (no new infrastructure):
- The Watchdog alert (W1) provides partial coverage: if Grafana cannot reach Slack, the heartbeat stops arriving, which is itself a signal — but only if someone notices its absence.
- Operators should periodically verify Slack delivery by checking that the Watchdog heartbeat message is arriving on schedule (every `repeat_interval`).
- The Grafana UI Alerting page shows rule states regardless of notification delivery. Checking rule states directly is the fallback when Slack is suspect.
- Test the Slack contact point monthly using Grafana's built-in "Test" button (Alerting > Contact points > Test).

**Weekly operator checklist**: Open Grafana Alerting page and confirm no rules are in Error state. This catches Loki partial failures and datasource auth drift that don't trigger Slack notifications. **Owner**: On-call operator. **Where**: Add as a recurring item in the on-call handoff checklist or weekly ops standup agenda.

This is an accepted v1 limitation. Adding a secondary channel (email, PagerDuty, OpsGenie) is deferred to v2.

---

## Files to Create

```
.claude/skills/check-logs/
  SKILL.md                # Skill definition (YAML frontmatter + instructions)
  README.md               # Prerequisites + usage
  queries.md              # LogQL query catalog (current + future versions, bash + PowerShell)

infrastructure/grafana/provisioning/alerting/
  ironscout-alerts.yaml              # 10 alert rules + 1 watchdog
  ironscout-contact-points.yaml      # Slack webhook contact point
  ironscout-notification-policies.yaml  # Routing + anti-flapping
  ironscout-templates.yaml           # Slack message templates
```

## Files to Modify

- `context/operations/02_monitoring_and_observability.md` — Add "Log Monitoring (Grafana + Loki)" section.
- `context/reference/env.md` — Add `GRAFANA_SA_TOKEN`, `GRAFANA_URL`, `LOKI_DATASOURCE_UID` documentation with security guidance.

---

## Environment Variables

### Developer-local (not on Render services)

| Var | Purpose | Security |
|-----|---------|----------|
| `GRAFANA_SA_TOKEN` | Grafana service account token for `/check-logs` skill | Scope: Viewer role (read-only). Storage: shell profile or `.env.local` (never committed). Rotation: quarterly or on team member departure. Revocation: Grafana > Administration > Service Accounts > token > Delete. |
| `GRAFANA_URL` | Grafana base URL | Default: `http://10.10.9.28:3001` |
| `LOKI_DATASOURCE_UID` | Loki datasource UID string | Default: `loki`. Validated at runtime by resolving against Grafana API. |

### Grafana host

| Var | Purpose |
|-----|---------|
| `SLACK_DATAFEED_ALERTS_WEBHOOK_URL` | Same Slack webhook used by the app. Set as environment variable on the Grafana server for alert contact point interpolation. |

---

## Verification

1. Run `/check-logs` — verify report renders with summary table, findings, pipeline health, blind spots section, and coverage status.
2. Run `/check-logs 1h` — verify time window parameter works.
3. Without `GRAFANA_SA_TOKEN` — verify skill asks for it.
4. With Grafana unreachable — verify graceful error.
5. Verify datasource UID resolution (not numeric ID) works with the proxy endpoint.
6. Copy provisioning YAMLs to Grafana host, restart Grafana — verify rules appear in UI (11 total).
7. Test Slack contact point via Grafana UI "Test" button.
8. Verify watchdog alert fires and sends periodic heartbeat.
9. Temporarily lower a threshold to trigger an alert — verify Slack message arrives with runbook, owner, dashboard URL.
10. Disable scheduler, wait 6h window — verify ingestion stalled does NOT fire prematurely.
11. Simulate partial query failure in `/check-logs` — verify Partial Observability Warning appears and failed queries are listed.
12. Stop Alloy on the logging server — verify Log Ingestion Stalled (rule 5) fires within ~15 minutes. Verify that other threshold rules do NOT false-fire (they should show OK due to noDataState: OK).
13. Verify Harvester Restart Storm (rule 4) does NOT fire during a single normal harvester restart (1 boot = 1 event).
14. Send a known 404 and 500 request to the API, then confirm the resulting log line matches D2 and E2 regex patterns exactly. If serialization differs, update patterns before provisioning.
15. Restart API once; verify `count_over_time({source="render"} |~ "API server started"[10m])` returns exactly 1. Restart Harvester once; verify `count_over_time({source="render"} |~ "Scheduler settings loaded"[10m])` returns exactly 1. If either returns >1 per boot (e.g., deploy logs twice), adjust restart storm thresholds.

---

## Future: Alloy Label Migration and Service-Level Segmentation

When Alloy JSON extraction is fixed and `service_name`, `level`, and other labels are reliably populated:

1. Update `queries.md` — switch from `|~` body patterns to label selectors (e.g., `{level="error"}`).
2. Update alert rule `expr` in `ironscout-alerts.yaml`.
3. Add per-service routing labels to alert rules for targeted notifications.
4. Label-based queries are faster and more reliable.

**Service-level segmentation**: Currently, all alert rules query `{source="render"}` which aggregates logs from all services (API, Harvester, Web, Admin, Merchant) into a single stream. This reduces clarity in several ways:
- The Error Rate Spike rule (rule 6) fires on aggregate error count. 15 errors from the API and 6 from the harvester independently may be normal, but combined they cross the threshold. Conversely, 20 errors from a single service are masked if other services are quiet.
- Runbook triage requires manually filtering logs by service to determine which service is affected.
- The Restart Storm rules (#2, #4) partially work around this by matching service-specific log messages, but other rules cannot.

When `service_name` labels are available, rules should be segmented:
- `{source="render", service_name="api"} |~ "\"level\":\"error\""` — per-service error rate
- `{source="render", service_name="harvester"} |~ "INGEST_RUN_SUMMARY"` — harvester-specific ingestion

This is a v2 change. Do not assume labels are available until Alloy extraction is confirmed working.

## Future: Relative Error Spike Detection

The v1 Error Rate Spike rule (rule 6) uses a static threshold: count > 20 in 5m. This has known limitations:

- **Baseline drift**: As traffic grows or new services are added, the static threshold may need manual recalibration.
- **Low-traffic false negatives**: During off-peak hours, a 10x spike from 1 to 10 errors goes undetected.
- **High-traffic false positives**: During peak traffic, normal error volume may approach the static threshold.

A relative spike detection approach would compare the current window to a rolling baseline:
```
count_over_time({source="render"} |~ "\"level\":\"error\""[5m])
  > 3 * avg(count_over_time({source="render"} |~ "\"level\":\"error\""[5m])[1h:5m])
```

This fires when the current 5m error count exceeds 3x the hourly rolling average. It adapts to traffic patterns and catches relative spikes regardless of absolute volume.

This requires Grafana alerting support for range-over-range queries, which is available in Grafana 10+. Deferred to v2 after validating that the Loki query performance is acceptable for alerting evaluation intervals.

## Future: Event Name Standardization

Auth and payment code paths don't use `event_name` fields. If these become monitoring-critical:
1. Add `event_name: LOG_EVENTS.AUTH_LOGIN_FAILURE` to auth error log calls in `routes/auth.ts`.
2. Add structured payment failure log events alongside DB audit writes in `routes/payments.ts`.
3. Update `queries.md` to use the new reliable `event_name` predicates.
