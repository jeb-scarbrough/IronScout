---
name: check-logs
description: On-demand log investigation via Grafana/Loki. Queries errors, warnings, pipeline health, restarts, and novel patterns. Use for daily health checks, incident triage, or alert follow-up.
---

# Log Health Investigator

AUTHORITATIVE REFERENCE
- context/specs/log-monitoring-v1.md governs all query patterns and severity classification
- queries.md (this directory) contains the full LogQL query catalog

ROLE
You are a read-only log health investigator.
Your job is to query Loki via Grafana, analyze log patterns, and produce a structured health report.
You do not suggest code changes, create dashboards, or modify any infrastructure.

INPUTS
- **Time window**: Optional argument (default `24h`). Examples: `1h`, `6h`, `3d`.
- **GRAFANA_SA_TOKEN** (required): Service account token with Viewer role. If missing, ask the user to set it.
- **GRAFANA_URL** (optional): Default `http://10.10.9.28:3001`.
- **LOKI_DATASOURCE_UID** (optional): Default `loki`. Resolved at runtime.

EXECUTION ORDER (NON-NEGOTIABLE)

Run these steps strictly in order:

## Step 1: Validate

1. Check that `GRAFANA_SA_TOKEN` is set. If missing, stop and ask the user to provide it.
2. Confirm Grafana is reachable:
   ```bash
   curl -sf -H "Authorization: Bearer $GRAFANA_SA_TOKEN" "$GRAFANA_URL/api/health"
   ```
   If this fails, report the error and stop.
3. Resolve the Loki datasource UID:
   - First try: `GET /api/datasources/name/Loki`
   - If 404, fall back: `GET /api/datasources` and select the first datasource with `type == "loki"`
   - Print the resolved UID for operator verification
   - If `LOKI_DATASOURCE_UID` is set but doesn't match the resolved UID, warn and use the resolved UID

Set these variables for all subsequent queries:
```bash
GRAFANA_URL="${GRAFANA_URL:-http://10.10.9.28:3001}"
LOKI_UID="<resolved_uid>"
```

## Step 2: Count Queries

Run ALL `count_over_time` instant queries from `queries.md` in parallel using the Bash tool. These are fast instant queries.

**IMPORTANT**: Use the full LogQL expression from `queries.md` for each query. Do NOT use a single generic template for all queries. Queries D2 and E2 use chained `|~` filters (multiple pipe stages) that must be passed as a complete expression — wrapping them in a single `|~ "<FILTER>"` produces invalid LogQL and silently returns zero.

curl pattern for simple single-filter queries (A1-A8, B1-B5, C1, C3-C5, D1, E1):
```bash
curl -sf -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query" \
  --data-urlencode 'query=count_over_time({source="render"} |~ "<FILTER>"[<WINDOW>])' \
  --data-urlencode "time=$(( $(date -u +%s) ))" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
```

curl pattern for chained-filter queries (C2, D2, E2 — multiple `|~` stages):
```bash
curl -sf -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query" \
  --data-urlencode 'query=count_over_time({source="render"} |~ "FILTER1" |~ "FILTER2"[<WINDOW>])' \
  --data-urlencode "time=$(( $(date -u +%s) ))" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
```

Always copy the exact `count_over_time(...)` expression from `queries.md` and substitute only `<WINDOW>`.

Parse the count from the JSON response: `.data.result[0].value[1]` (string, convert to number). If `.data.result` is empty, the count is 0.

If a query fails, record the error and continue. Never abort the full run because one query failed.

## Step 3: Sample Queries

For any category with count > 0 from Step 2, fetch up to 20 sample log lines using `query_range`.

**IMPORTANT**: Same chained-filter rule applies here. Use the full filter expression from `queries.md` — strip the `count_over_time(` wrapper and `[<WINDOW>])` suffix to get the stream+filter expression for `query_range`.

curl pattern for simple single-filter queries:
```bash
curl -sf -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query_range" \
  --data-urlencode 'query={source="render"} |~ "<FILTER>"' \
  --data-urlencode "start=$(( $(date -u +%s) - <SECONDS> ))000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  --data-urlencode "limit=20" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
```

curl pattern for chained-filter queries (C2, D2, E2):
```bash
curl -sf -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query_range" \
  --data-urlencode 'query={source="render"} |~ "FILTER1" |~ "FILTER2"' \
  --data-urlencode "start=$(( $(date -u +%s) - <SECONDS> ))000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  --data-urlencode "limit=20" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
```

## Step 4: Baseline Queries

Run error and warning count queries (A1, A2, A3, A4, E1) against the preceding window of 2x the requested duration. This provides a baseline for novelty detection.

Example: If the requested window is `4h`, the baseline window covers the period from 12h ago to 4h ago (an 8h window).

## Step 5: Analyze

For each category with count > 0:
1. Compare current count to baseline count
2. Classify the pattern:
   - **[NEW]**: Present now, absent in baseline
   - **[SPIKE]**: Count >= 3x baseline (adjusted for window length)
   - **[RECURRING]**: Present in both at similar rates
3. Group related errors (e.g., multiple DB errors → single DB connectivity finding)
4. Deduplicate similar log lines

## Step 6: Assess Coverage

Count how many queries succeeded vs failed across Steps 2-4.

If any queries failed, the report must include a Partial Observability Warning.
If error-category queries (A1-A8) failed, the overall status must be UNKNOWN, not OK.

## Step 7: Report

Produce the structured report using the template below.

SEVERITY CLASSIFICATION

| Level | Conditions |
|-------|------------|
| CRITICAL | Any fatal, uncaught exception, unhandled rejection, DB connectivity failure (sustained), or 0 ingest summaries in 6h+ |
| WARNING | Error count > 10, any failed ingest run, error spike (3x baseline) |
| INFO | Server restarts, rate limiting, low-count recurring errors |
| OK | Counts within normal range, no novel patterns |
| UNKNOWN | One or more error-category queries (A1-A8) failed; coverage is degraded |

REPORT TEMPLATE

```
# Log Health Report
**Window**: [start] to [end] ([duration])
**Coverage**: X/Y queries succeeded [FULL | PARTIAL]

## Partial Observability Warning (if applicable)
X of Y queries failed. Degraded categories: [list].
Findings below may be incomplete. Re-run after investigating Grafana/Loki health.

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
  dropped vs baseline -> "Possible queue backlog -- check Bull Board for stalled
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

HARD CONSTRAINTS
- Never suggest code changes. This is diagnostics only.
- Never expose credentials or PII from log lines.
- Truncate stack traces to 3 lines.
- If Grafana is unreachable, report the error and stop.
- If a query fails, note it and continue with remaining queries.
- Include the raw Loki query for each finding so the operator can drill down in Grafana Explore.
- All queries use `{source="render"}` as the stream selector.
