# LogQL Query Catalog

All queries use `{source="render"}` as the stream selector with `|~` filters on the log body.
This is required because Alloy JSON extraction is broken — `service_name`, `level`, and other labels are not reliably populated.

When Alloy label extraction is fixed, queries should migrate to label selectors (see Future section in spec).

---

## curl Templates

### Count Query (instant)

**Bash (MINGW/Git Bash)**:
```bash
GRAFANA_URL="${GRAFANA_URL:-http://10.10.9.28:3001}"
LOKI_UID="${LOKI_DATASOURCE_UID:-loki}"
curl -sf -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query" \
  --data-urlencode 'query=count_over_time({source="render"} |~ "<FILTER>"[<WINDOW>])' \
  --data-urlencode "time=$(( $(date -u +%s) ))" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
```

**PowerShell**:
```powershell
$GrafanaUrl = if ($env:GRAFANA_URL) { $env:GRAFANA_URL } else { "http://10.10.9.28:3001" }
$LokiUid = if ($env:LOKI_DATASOURCE_UID) { $env:LOKI_DATASOURCE_UID } else { "loki" }
$Time = [int][double]::Parse((Get-Date -UFormat %s))
Invoke-RestMethod -Uri "$GrafanaUrl/api/datasources/proxy/uid/$LokiUid/loki/api/v1/query" `
  -Headers @{ Authorization = "Bearer $env:GRAFANA_SA_TOKEN" } `
  -Body @{ query = 'count_over_time({source="render"} |~ "<FILTER>"[<WINDOW>])'; time = $Time }
```

### Sample Query (range)

**Bash (MINGW/Git Bash)**:
```bash
WINDOW_SECONDS=86400  # 24h
curl -sf -G "$GRAFANA_URL/api/datasources/proxy/uid/$LOKI_UID/loki/api/v1/query_range" \
  --data-urlencode 'query={source="render"} |~ "<FILTER>"' \
  --data-urlencode "start=$(( $(date -u +%s) - WINDOW_SECONDS ))000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  --data-urlencode "limit=20" \
  -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
```

**PowerShell**:
```powershell
$WindowSeconds = 86400
$Now = [int][double]::Parse((Get-Date -UFormat %s))
$Start = ($Now - $WindowSeconds).ToString() + "000000000"
$End = $Now.ToString() + "000000000"
Invoke-RestMethod -Uri "$GrafanaUrl/api/datasources/proxy/uid/$LokiUid/loki/api/v1/query_range" `
  -Headers @{ Authorization = "Bearer $env:GRAFANA_SA_TOKEN" } `
  -Body @{ query = '{source="render"} |~ "<FILTER>"'; start = $Start; end = $End; limit = 20 }
```

---

## A: Errors & Fatals (8 queries)

| ID | Name | LogQL Filter | Reliability |
|----|------|-------------|-------------|
| A1 | All errors | `"level":"error"` | Reliable (all loggers emit level) |
| A2 | All fatals | `"level":"fatal"` | Reliable |
| A3 | Uncaught exceptions | `uncaughtException\|Uncaught exception` | Regex on message |
| A4 | Unhandled rejections | `unhandledRejection\|Unhandled rejection` | Regex on message |
| A5 | DB errors | `"error_category":"db"` | Reliable (request-logger classifies) |
| A6 | External service errors | `"error_category":"external"` | Reliable |
| A7 | Timeout errors | `"error_category":"timeout"` | Reliable |
| A8 | Internal errors | `"error_category":"internal"` | Reliable |

### A1: All Errors
```
count_over_time({source="render"} |~ "\"level\":\"error\""[<WINDOW>])
```

### A2: All Fatals
```
count_over_time({source="render"} |~ "\"level\":\"fatal\""[<WINDOW>])
```

### A3: Uncaught Exceptions
```
count_over_time({source="render"} |~ "uncaughtException|Uncaught exception"[<WINDOW>])
```

### A4: Unhandled Rejections
```
count_over_time({source="render"} |~ "unhandledRejection|Unhandled rejection"[<WINDOW>])
```

### A5: DB Errors
```
count_over_time({source="render"} |~ "\"error_category\":\"db\""[<WINDOW>])
```

### A6: External Service Errors
```
count_over_time({source="render"} |~ "\"error_category\":\"external\""[<WINDOW>])
```

### A7: Timeout Errors
```
count_over_time({source="render"} |~ "\"error_category\":\"timeout\""[<WINDOW>])
```

### A8: Internal Errors
```
count_over_time({source="render"} |~ "\"error_category\":\"internal\""[<WINDOW>])
```

---

## B: Application Health (5 queries)

| ID | Name | LogQL Filter | Reliability |
|----|------|-------------|-------------|
| B1 | API starts | `API server started` | Regex on message. Exactly 1 per API boot. |
| B2 | Harvester boots | `Scheduler settings loaded` | Regex on message. Exactly 1 per harvester boot. Do NOT match WORKER_START. |
| B3 | Prisma errors | `PrismaClient.*Error\|P2002\|P2025` | Regex on error strings |
| B4 | Connection errors | `ECONNREFUSED\|ECONNRESET\|ETIMEDOUT` | Regex on error strings |
| B5 | Redis errors | `MaxRetriesPerRequestError\|ECONNREFUSED.*6379\|redis.*NOAUTH\|READONLY.*redis\|Connection is closed` | Regex on error strings |

### B1: API Starts
```
count_over_time({source="render"} |~ "API server started"[<WINDOW>])
```

### B2: Harvester Boots
```
count_over_time({source="render"} |~ "Scheduler settings loaded"[<WINDOW>])
```
Note: Do NOT match `WORKER_START` — a single healthy harvester boot emits 5+ WORKER_START events.

### B3: Prisma Errors
```
count_over_time({source="render"} |~ "PrismaClient.*Error|P2002|P2025"[<WINDOW>])
```

### B4: Connection Errors
```
count_over_time({source="render"} |~ "ECONNREFUSED|ECONNRESET|ETIMEDOUT"[<WINDOW>])
```

### B5: Redis Errors
```
count_over_time({source="render"} |~ "MaxRetriesPerRequestError|ECONNREFUSED.*6379|redis.*NOAUTH|READONLY.*redis|Connection is closed"[<WINDOW>])
```
Note: Excludes `Redis connection` (matches healthy startup log `Configured Redis connection`) and redundant `MaxRetriesPerRequest` (subset of `MaxRetriesPerRequestError`). Aligned with alert rule `ironscout-redis-connectivity`.

---

## C: Harvester Pipeline (5 queries)

| ID | Name | LogQL Filter | Reliability |
|----|------|-------------|-------------|
| C1 | All ingest summaries | `INGEST_RUN_SUMMARY` | Reliable (event_name field) |
| C2 | Failed ingest runs | `INGEST_RUN_SUMMARY.*"status":"FAILED"` | Reliable (status enum) |
| C3 | Circuit breakers | `circuit.*breaker\|CIRCUIT_BREAKER` | Regex on message |
| C4 | Feed auto-disabled | `auto.*disabled\|AUTO_DISABLED` | Regex on message |
| C5 | Embedding errors | `EMBEDDING_JOB_FAILED\|EMBEDDING_WORKER_ERROR` | Reliable (event_name field) |

**Pipeline note**: AFFILIATE is the primary production pipeline. RETAILER summaries may be absent depending on deployment configuration. Absence of RETAILER summaries alone is not a failure signal.

### C1: All Ingest Summaries
```
count_over_time({source="render"} |~ "INGEST_RUN_SUMMARY"[<WINDOW>])
```

### C2: Failed Ingest Runs
```
count_over_time({source="render"} |~ "INGEST_RUN_SUMMARY" |~ "\"status\":\"FAILED\""[<WINDOW>])
```

### C3: Circuit Breakers
```
count_over_time({source="render"} |~ "circuit.*breaker|CIRCUIT_BREAKER"[<WINDOW>])
```

### C4: Feed Auto-Disabled
```
count_over_time({source="render"} |~ "auto.*disabled|AUTO_DISABLED"[<WINDOW>])
```

### C5: Embedding Errors
```
count_over_time({source="render"} |~ "EMBEDDING_JOB_FAILED|EMBEDDING_WORKER_ERROR"[<WINDOW>])
```

---

## D: Security & Auth (2 queries)

| ID | Name | LogQL Filter | Reliability |
|----|------|-------------|-------------|
| D1 | Auth errors/warnings | `Signin error\|OAuth signin error\|Blocked credentials login\|OAuth.*failed` | Regex on actual auth.ts messages |
| D2 | HTTP 4xx auth routes | (chained filter — see below) | Reliable (request-logger) |

### D1: Auth Errors/Warnings
```
count_over_time({source="render"} |~ "Signin error|OAuth signin error|Blocked credentials login|OAuth.*failed"[<WINDOW>])
```

### D2: HTTP 4xx Auth Routes
Uses chained `|~` filters — each filter is independent of JSON field order:
```
count_over_time({source="render"} |~ "http.request.end" |~ "/api/auth" |~ "status_code.*4[0-9]"[<WINDOW>])
```

---

## E: Warnings (2 queries)

| ID | Name | LogQL Filter | Reliability |
|----|------|-------------|-------------|
| E1 | All warnings | `"level":"warn"` | Reliable |
| E2 | HTTP 5xx | (chained filter — see below) | Reliable (request-logger). Anchored to JSON value position to prevent greedy cross-field matching. |

### E1: All Warnings
```
count_over_time({source="render"} |~ "\"level\":\"warn\""[<WINDOW>])
```

### E2: HTTP 5xx
Uses chained `|~` filters for field-order safety. The status_code pattern is anchored to the JSON value position to prevent greedy `.*` from matching latency or other numeric fields (e.g. `"status_code":200,"latency_ms":52` would false-match `status_code.*5[0-9]`).
```
count_over_time({source="render"} |~ "http.request.end" |~ "\"status_code\":5[0-9][0-9]"[<WINDOW>])
```

---

## Queue Backlog Heuristic

BullMQ queue depth is not available in Loki (known blind spot). However, a proxy signal exists:

If Redis errors (B5) > 0 AND ingest summary count (C1) dropped compared to baseline, this suggests possible queue backlog — jobs were not processed during the Redis outage.

When this pattern is detected, report:
> "Possible queue backlog — check Bull Board for stalled jobs after Redis recovery"
