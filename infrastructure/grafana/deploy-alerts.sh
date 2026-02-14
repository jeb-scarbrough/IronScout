#!/usr/bin/env bash
# deploy-alerts.sh — Deploy IronScout Grafana alerts via HTTP API
# Source of truth: infrastructure/grafana/provisioning/alerting/*.yaml
#
# Usage: GRAFANA_SA_TOKEN=glsa_xxx SLACK_DATAFEED_ALERTS_WEBHOOK_URL=https://... bash deploy-alerts.sh [--yes]

set -euo pipefail

# ── Flags ──
AUTO_CONFIRM=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_CONFIRM=true ;;
    --help|-h)
      echo "Usage: deploy-alerts.sh [--yes]"
      echo "  --yes, -y  Auto-confirm notification policy overwrite"
      echo ""
      echo "Required env vars:"
      echo "  GRAFANA_SA_TOKEN                       Service account token (Editor/Admin role)"
      echo "  SLACK_DATAFEED_ALERTS_WEBHOOK_URL       Slack webhook URL"
      echo ""
      echo "Optional env vars:"
      echo "  GRAFANA_URL                            Default: http://10.10.9.28:3001"
      exit 0
      ;;
  esac
done

# ── Prerequisites ──
: "${GRAFANA_SA_TOKEN:?GRAFANA_SA_TOKEN is required (service account token with Editor or Admin role)}"
: "${SLACK_DATAFEED_ALERTS_WEBHOOK_URL:?SLACK_DATAFEED_ALERTS_WEBHOOK_URL is required}"
GRAFANA_URL="${GRAFANA_URL:-http://10.10.9.28:3001}"

command -v jq   >/dev/null 2>&1 || { echo "ERROR: jq is required but not installed." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required but not installed." >&2; exit 1; }

FOLDER_UID="ironscout-alerts"
FOLDER_TITLE="IronScout Alerts"

# ── Helpers ──

_BODY_FILE=$(mktemp)
trap 'rm -f "$_BODY_FILE"' EXIT
LAST_HTTP_CODE=0

# Makes a Grafana API call.
# Writes response body to $_BODY_FILE, returns HTTP status code via stdout.
# Usage: LAST_HTTP_CODE=$(grafana_api METHOD /path [json_body])
#        body=$(cat "$_BODY_FILE")
grafana_api() {
  local method="$1" path="$2"
  shift 2
  local -a args=(
    -s -o "$_BODY_FILE" -w '%{http_code}'
    -H "Authorization: Bearer $GRAFANA_SA_TOKEN"
    -H "Content-Type: application/json"
    -H "X-Disable-Provenance: true"
    -X "$method"
  )
  [[ $# -gt 0 ]] && args+=(-d "$1")
  curl "${args[@]}" "${GRAFANA_URL}${path}"
}

die() {
  local body
  body=$(cat "$_BODY_FILE")
  echo "FAILED (HTTP $LAST_HTTP_CODE)" >&2
  echo "$body" | jq . 2>/dev/null || echo "$body" >&2
  exit 1
}

urlencode() { jq -rn --arg s "$1" '$s | @uri'; }

# Build a Loki-based alert rule JSON object.
# Reads from variables: R_TITLE R_EXPR R_FROM R_FOR R_NODATA R_EXECERR
#   R_SEVERITY R_ALERTNAME R_SUMMARY R_DESC R_DASH R_RUNBOOK R_GROUP
#   LOKI_UID GRAFANA_URL FOLDER_UID
build_loki_rule() {
  jq -n \
    --arg title     "$R_TITLE" \
    --arg expr      "$R_EXPR" \
    --argjson from  "$R_FROM" \
    --arg for_d     "$R_FOR" \
    --arg noData    "$R_NODATA" \
    --arg execErr   "$R_EXECERR" \
    --arg severity  "$R_SEVERITY" \
    --arg alertname "$R_ALERTNAME" \
    --arg summary   "$R_SUMMARY" \
    --arg desc      "$R_DESC" \
    --arg dash      "$R_DASH" \
    --arg runbook   "$R_RUNBOOK" \
    --arg loki      "$LOKI_UID" \
    --arg gurl      "$GRAFANA_URL" \
    --arg folder    "$FOLDER_UID" \
    --arg group     "$R_GROUP" \
    '{
      title: $title,
      ruleGroup: $group,
      folderUID: $folder,
      condition: "A",
      data: [{
        refId: "A",
        datasourceUid: $loki,
        relativeTimeRange: { from: $from, to: 0 },
        model: {
          expr: $expr,
          instant: true,
          refId: "A"
        }
      }],
      for: $for_d,
      noDataState: $noData,
      execErrState: $execErr,
      labels: {
        severity: $severity,
        alertname: $alertname,
        owner: "ops"
      },
      annotations: {
        summary: $summary,
        description: $desc,
        owner: "ops",
        dashboard_url: ($gurl + $dash),
        runbook: $runbook
      }
    }'
}

# ════════════════════════════════════════════════════
# Step 1/6: Resolve Loki datasource UID
# ════════════════════════════════════════════════════
printf '[1/6] Resolving Loki datasource UID... '

LAST_HTTP_CODE=$(grafana_api GET /api/datasources/name/Loki)
if [[ "$LAST_HTTP_CODE" -eq 200 ]]; then
  LOKI_UID=$(jq -r '.uid' "$_BODY_FILE")
else
  LAST_HTTP_CODE=$(grafana_api GET /api/datasources)
  [[ "$LAST_HTTP_CODE" -eq 200 ]] || die
  LOKI_UID=$(jq -r '[.[] | select(.type == "loki")][0].uid // empty' "$_BODY_FILE")
fi

[[ -n "${LOKI_UID:-}" ]] || { echo "FAILED — no Loki datasource found" >&2; exit 1; }
echo "OK (uid: $LOKI_UID)"

# ════════════════════════════════════════════════════
# Step 2/6: Create folder
# ════════════════════════════════════════════════════
printf '[2/6] Creating folder "%s"... ' "$FOLDER_TITLE"

LAST_HTTP_CODE=$(grafana_api POST /api/folders \
  "$(jq -n --arg uid "$FOLDER_UID" --arg title "$FOLDER_TITLE" '{uid: $uid, title: $title}')")

if [[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]]; then
  echo "OK (created)"
elif [[ "$LAST_HTTP_CODE" -eq 409 || "$LAST_HTTP_CODE" -eq 412 ]]; then
  echo "OK (already exists)"
else
  die
fi

# ════════════════════════════════════════════════════
# Step 3/6: Create contact point
# ════════════════════════════════════════════════════
printf '[3/6] Creating contact point "IronScout Slack"... '

CP_NAME="IronScout Slack"
LAST_HTTP_CODE=$(grafana_api GET /api/v1/provisioning/contact-points)
[[ "$LAST_HTTP_CODE" -eq 200 ]] || die

existing_cp_uid=$(jq -r --arg name "$CP_NAME" \
  '[.[] | select(.name == $name)][0].uid // empty' "$_BODY_FILE")

CP_SETTINGS=$(jq -n \
  --arg url "$SLACK_DATAFEED_ALERTS_WEBHOOK_URL" \
  --arg title '{{ template "ironscout-alert.title" . }}' \
  --arg text  '{{ template "ironscout-alert.text" . }}' \
  '{ url: $url, title: $title, text: $text }')

if [[ -n "$existing_cp_uid" ]]; then
  cp_body=$(jq -n \
    --arg uid "$existing_cp_uid" \
    --arg name "$CP_NAME" \
    --argjson settings "$CP_SETTINGS" \
    '{ uid: $uid, name: $name, type: "slack", settings: $settings }')
  LAST_HTTP_CODE=$(grafana_api PUT "/api/v1/provisioning/contact-points/$existing_cp_uid" "$cp_body")
  [[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
  echo "OK (updated)"
else
  cp_body=$(jq -n \
    --arg name "$CP_NAME" \
    --argjson settings "$CP_SETTINGS" \
    '{ name: $name, type: "slack", settings: $settings }')
  LAST_HTTP_CODE=$(grafana_api POST /api/v1/provisioning/contact-points "$cp_body")
  [[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
  echo "OK (created)"
fi

# ════════════════════════════════════════════════════
# Step 4/6: Create message template
# ════════════════════════════════════════════════════
printf '[4/6] Creating message template "ironscout-alert"... '

TEMPLATE_CONTENT='{{ define "ironscout-alert.title" }}
[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ (index .Alerts 0).Labels.alertname }}
{{ end }}

{{ define "ironscout-alert.text" }}
{{ range .Alerts }}
*{{ .Labels.alertname }}* — severity: `{{ .Labels.severity }}`

{{ if .Annotations.summary }}*Summary:* {{ .Annotations.summary }}{{ end }}
{{ if .Annotations.description }}*Description:* {{ .Annotations.description }}{{ end }}

{{ if .Annotations.runbook }}*Runbook:*
{{ .Annotations.runbook }}{{ end }}

{{ if .Annotations.owner }}*Owner:* {{ .Annotations.owner }}{{ end }}
{{ if .Annotations.dashboard_url }}*Dashboard:* {{ .Annotations.dashboard_url }}{{ end }}

*Started:* {{ .StartsAt.Format "2006-01-02 15:04:05 UTC" }}
{{ if .EndsAt }}*Ended:* {{ .EndsAt.Format "2006-01-02 15:04:05 UTC" }}{{ end }}
---
{{ end }}
{{ end }}'

tmpl_body=$(jq -n \
  --arg name "ironscout-alert" \
  --arg template "$TEMPLATE_CONTENT" \
  '{ name: $name, template: $template }')

LAST_HTTP_CODE=$(grafana_api PUT /api/v1/provisioning/templates/ironscout-alert "$tmpl_body")
[[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
echo "OK"

# ════════════════════════════════════════════════════
# Step 5/6: Create alert rule groups
# ════════════════════════════════════════════════════
echo '[5/6] Creating alert rule groups...'

# ── Critical Rule 1: Fatal Error ──
R_GROUP="IronScout Critical"
R_TITLE="Fatal Error"
R_EXPR='count_over_time({source="render"} |~ "\"level\":\"fatal\""[5m]) > 0'
R_FROM=300; R_FOR="0s"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="critical"; R_ALERTNAME="ironscout-fatal-error"
R_SUMMARY="Fatal error detected in IronScout logs"
R_DESC="A fatal-level log event was emitted by one of the IronScout services. This typically indicates an unrecoverable error that crashed or will crash the process."
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22%5C%5C%5C%22level%5C%5C%5C%22:%5C%5C%5C%22fatal%5C%5C%5C%22%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check Grafana Explore for the fatal log line — identify service and stack trace.
2. Check if service restarted (correlate with API/Harvester restart events).
3. Escalation: if fatal persists after restart, page on-call.'
rule_c1=$(build_loki_rule)

# ── Critical Rule 2: API Restart Storm ──
R_GROUP="IronScout Critical"
R_TITLE="API Restart Storm"
R_EXPR='count_over_time({source="render"} |~ "API server started"[10m]) >= 3'
R_FROM=600; R_FOR="0s"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="critical"; R_ALERTNAME="ironscout-api-restart-storm"
R_SUMMARY="API restarted 3+ times in 10 minutes"
R_DESC='The API service has restarted 3 or more times in a 10-minute window. This indicates a crash loop. Each restart is detected by the "API server started" log message (exactly 1 per boot).'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22API%20server%20started%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check Render dashboard for API service deploy or crash events.
2. Check Grafana for error logs immediately before each restart.
3. Escalation: if crash-looping with no deploy, check for OOM or unhandled exception.'
rule_c2=$(build_loki_rule)

# ── Critical Rule 3: DB Connectivity ──
R_GROUP="IronScout Critical"
R_TITLE="DB Connectivity"
R_EXPR='count_over_time({source="render"} |~ "PrismaClientInitializationError|Can.t reach database|ECONNREFUSED|ENOTFOUND|Connection terminated|remaining connection slots|too many clients"[5m]) > 0'
R_FROM=300; R_FOR="2m"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="critical"; R_ALERTNAME="ironscout-db-connectivity"
R_SUMMARY="Database connectivity failure detected"
R_DESC='Database connectivity errors detected — covers Prisma initialization failures, DNS resolution failures, TCP connection failures, mid-query disconnects, and connection pool saturation.'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22PrismaClientInitializationError%7CCan.t%20reach%20database%7CECONNREFUSED%7CENOTFOUND%7CConnection%20terminated%7Cremaining%20connection%20slots%7Ctoo%20many%20clients%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check Render PostgreSQL dashboard for status/maintenance.
2. Check for "remaining connection slots" or "too many clients" (pool saturation).
3. Restart API only after DB confirmed healthy; if DB is healthy, check for connection leak in recent deploys.'
rule_c3=$(build_loki_rule)

# ── Critical Rule 4: Harvester Restart Storm ──
R_GROUP="IronScout Critical"
R_TITLE="Harvester Restart Storm"
R_EXPR='count_over_time({source="render"} |~ "Scheduler settings loaded"[10m]) >= 3'
R_FROM=600; R_FOR="0s"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="critical"; R_ALERTNAME="ironscout-harvester-restart-storm"
R_SUMMARY="Harvester restarted 3+ times in 10 minutes"
R_DESC='The harvester service has restarted 3 or more times in a 10-minute window. This indicates a crash loop. Rapid restarts risk ADR-001 scheduler singleton violations and BullMQ stalled job accumulation.'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22Scheduler%20settings%20loaded%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check Render dashboard for harvester service crashes.
2. Check for Redis/DB connectivity errors preceding each restart.
3. Escalation: disable scheduler via Admin UI > Settings > Danger Zone > toggle "Main Harvester Scheduler" to Disable to prevent ADR-001 scheduler overlap violations.'
rule_c4=$(build_loki_rule)

# ── Critical Rule 5: Log Ingestion Stalled ──
R_GROUP="IronScout Critical"
R_TITLE="Log Ingestion Stalled"
R_EXPR='count_over_time({source="render"}[10m]) == 0'
R_FROM=600; R_FOR="5m"; R_NODATA="Alerting"; R_EXECERR="Alerting"
R_SEVERITY="critical"; R_ALERTNAME="ironscout-log-ingestion-stalled"
R_SUMMARY="No logs arriving in Loki from Render services"
R_DESC='Zero log lines received from {source="render"} in the last 10 minutes. This means the Render -> Alloy -> Loki pipeline is broken. All other threshold-based alert rules will silently evaluate against empty data and report OK.'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%22%7D%5D%7D'
R_RUNBOOK='1. SSH to logging host (10.10.9.28) — check Alloy process status (systemctl status alloy) and syslog receiver.
2. Check Loki health endpoint (http://10.10.9.28:3100/ready, /metrics).
3. Check Render syslog drain configuration for changes (Render Dashboard > Environment > Syslog Drain).'
rule_c5=$(build_loki_rule)

# ── Warning Rule 6: Error Rate Spike ──
R_GROUP="IronScout Warning"
R_TITLE="Error Rate Spike"
R_EXPR='count_over_time({source="render"} |~ "\"level\":\"error\""[5m]) > 20'
R_FROM=300; R_FOR="5m"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="warning"; R_ALERTNAME="ironscout-error-rate-spike"
R_SUMMARY="Error rate exceeds 20 errors in 5 minutes"
R_DESC='More than 20 error-level log events in a 5-minute window, sustained for 5 minutes. This threshold is calibrated for major incidents only. Use /check-logs for faster detection of minor degradation.'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22%5C%5C%5C%22level%5C%5C%5C%22:%5C%5C%5C%22error%5C%5C%5C%22%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check Grafana Explore — filter by "level":"error" and group by error message.
2. Identify if errors are from one service or spread across all.
3. Escalation: if localized, check recent deploys to that service.'
rule_w6=$(build_loki_rule)

# ── Warning Rule 7: Prisma Errors ──
R_GROUP="IronScout Warning"
R_TITLE="Prisma Errors"
R_EXPR='count_over_time({source="render"} |~ "PrismaClientValidationError|PrismaClientKnownRequestError"[5m]) >= 5'
R_FROM=300; R_FOR="5m"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="warning"; R_ALERTNAME="ironscout-prisma-errors"
R_SUMMARY="Sustained Prisma errors (5+ in 5 minutes)"
R_DESC='PrismaClientValidationError or PrismaClientKnownRequestError occurring at a sustained rate. ValidationError indicates code bugs; KnownRequestError indicates data/constraint issues.'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22PrismaClientValidationError%7CPrismaClientKnownRequestError%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check error messages — ValidationError = code bug; KnownRequestError = data/constraint issue.
2. Correlate with recent deploys.
3. Escalation: if sustained and not deploy-related, check for schema drift.'
rule_w7=$(build_loki_rule)

# ── Warning Rule 8: Ingest Run Failures ──
R_GROUP="IronScout Warning"
R_TITLE="Ingest Run Failures"
R_EXPR='count_over_time({source="render"} |~ "INGEST_RUN_SUMMARY" |~ "\"status\":\"FAILED\""[30m]) >= 3'
R_FROM=1800; R_FOR="5m"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="warning"; R_ALERTNAME="ironscout-ingest-run-failures"
R_SUMMARY="3+ failed ingest runs in 30 minutes"
R_DESC='Multiple INGEST_RUN_SUMMARY events with status FAILED in a 30-minute window. Covers both AFFILIATE and RETAILER pipelines. This alert is the only Slack coverage for RETAILER pipeline failures.'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22INGEST_RUN_SUMMARY%5C%22%20%7C~%20%5C%22%5C%5C%5C%22status%5C%5C%5C%22:%5C%5C%5C%22FAILED%5C%5C%5C%22%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check INGEST_RUN_SUMMARY logs for pipeline (AFFILIATE vs RETAILER) and error codes.
2. For AFFILIATE: check if circuit breaker fired or feed was auto-disabled.
3. Escalation: if multiple feeds failing, check upstream source availability.'
rule_w8=$(build_loki_rule)

# ── Warning Rule 9: Ingestion Stalled ──
R_GROUP="IronScout Warning"
R_TITLE="Ingestion Stalled"
R_EXPR='count_over_time({source="render"} |~ "INGEST_RUN_SUMMARY"[6h]) == 0'
R_FROM=21600; R_FOR="30m"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="warning"; R_ALERTNAME="ironscout-ingestion-stalled"
R_SUMMARY="No ingest run summaries in 6 hours"
R_DESC='Zero INGEST_RUN_SUMMARY events in 6 hours. This could mean the harvester is down, the scheduler is disabled, or the harvester is crash-looping before producing summaries. Worst-case detection latency is ~6h30m. Use /check-logs 1h for faster verification during active triage.'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22INGEST_RUN_SUMMARY%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check harvester service status on Render (running? restarting?).
2. Check if scheduler is intentionally disabled via Admin Settings.
3. If unintentional: check Redis connectivity and BullMQ queue status via Bull Board.'
rule_w9=$(build_loki_rule)

# ── Warning Rule 10: Redis Connectivity ──
R_GROUP="IronScout Warning"
R_TITLE="Redis Connectivity"
R_EXPR='count_over_time({source="render"} |~ "MaxRetriesPerRequestError|ECONNREFUSED.*6379|redis.*NOAUTH|READONLY.*redis|Connection is closed"[5m]) > 0'
R_FROM=300; R_FOR="3m"; R_NODATA="OK"; R_EXECERR="Error"
R_SEVERITY="warning"; R_ALERTNAME="ironscout-redis-connectivity"
R_SUMMARY="Redis connectivity errors detected"
R_DESC='Redis connectivity errors detected — covers max retries exhausted, connection refused, auth failures (NOAUTH), read-only replica errors, and closed connections. Does NOT cover queue backlog growth or stalled job accumulation (known blind spot).'
R_DASH='/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22%7Bsource%3D%5C%22render%5C%22%7D%20%7C~%20%5C%22MaxRetriesPerRequestError%7CECONNREFUSED.*6379%7Credis.*NOAUTH%7CREADONLY.*redis%7CConnection%20is%20closed%5C%22%22%7D%5D%7D'
R_RUNBOOK='1. Check Render Redis dashboard for status/maintenance.
2. After Redis recovers: check BullMQ queues via Bull Board for stalled/waiting backlog.
3. Escalation: if Redis is healthy, check for NOAUTH (credential rotation) or READONLY (failover).'
rule_w10=$(build_loki_rule)

# ── Watchdog Rule W1: Monitoring Heartbeat ──
watchdog_rule=$(jq -n \
  --arg gurl "$GRAFANA_URL" \
  --arg folder "$FOLDER_UID" \
  --arg summary "IronScout monitoring heartbeat (dead man's switch)" \
  --arg desc "This alert is intentionally always firing. Expect periodic heartbeat messages in Slack at the repeat_interval cadence (4h for warning severity). If Slack stops receiving this heartbeat, either Grafana cannot evaluate rules or cannot deliver notifications. The watchdog does not confirm Slack actually displays messages — verify heartbeat arrival manually." \
  --arg runbook "1. Check Grafana service is running and alert evaluation is not paused.
2. Test Slack contact point manually (Alerting > Contact points > Test).
3. Check Grafana server logs for delivery errors." \
  '{
    title: "Monitoring Heartbeat",
    ruleGroup: "IronScout Watchdog",
    folderUID: $folder,
    condition: "A",
    data: [{
      refId: "A",
      datasourceUid: "__expr__",
      relativeTimeRange: { from: 300, to: 0 },
      model: {
        type: "math",
        expression: "1",
        refId: "A"
      }
    }],
    for: "0s",
    noDataState: "Alerting",
    execErrState: "Alerting",
    labels: {
      severity: "warning",
      alertname: "ironscout-watchdog",
      owner: "ops"
    },
    annotations: {
      summary: $summary,
      description: $desc,
      owner: "ops",
      dashboard_url: ($gurl + "/alerting/list"),
      runbook: $runbook
    }
  }')

# ── Deploy Critical group (5 rules, interval 60s) ──
printf '  - IronScout Critical (5 rules)... '

critical_rules=$(printf '%s\n' "$rule_c1" "$rule_c2" "$rule_c3" "$rule_c4" "$rule_c5" | jq -s '.')
critical_body=$(jq -n --argjson rules "$critical_rules" --arg folder "$FOLDER_UID" \
  '{ title: "IronScout Critical", folderUid: $folder, interval: 60, rules: $rules }')

encoded=$(urlencode "IronScout Critical")
LAST_HTTP_CODE=$(grafana_api PUT "/api/v1/provisioning/folder/$FOLDER_UID/rule-groups/$encoded" "$critical_body")
[[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
echo "OK"

# ── Deploy Warning group (5 rules, interval 120s) ──
printf '  - IronScout Warning (5 rules)... '

warning_rules=$(printf '%s\n' "$rule_w6" "$rule_w7" "$rule_w8" "$rule_w9" "$rule_w10" | jq -s '.')
warning_body=$(jq -n --argjson rules "$warning_rules" --arg folder "$FOLDER_UID" \
  '{ title: "IronScout Warning", folderUid: $folder, interval: 120, rules: $rules }')

encoded=$(urlencode "IronScout Warning")
LAST_HTTP_CODE=$(grafana_api PUT "/api/v1/provisioning/folder/$FOLDER_UID/rule-groups/$encoded" "$warning_body")
[[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
echo "OK"

# ── Deploy Watchdog group (1 rule, interval 300s) ──
printf '  - IronScout Watchdog (1 rule)... '

watchdog_rules=$(printf '%s\n' "$watchdog_rule" | jq -s '.')
watchdog_body=$(jq -n --argjson rules "$watchdog_rules" --arg folder "$FOLDER_UID" \
  '{ title: "IronScout Watchdog", folderUid: $folder, interval: 300, rules: $rules }')

encoded=$(urlencode "IronScout Watchdog")
LAST_HTTP_CODE=$(grafana_api PUT "/api/v1/provisioning/folder/$FOLDER_UID/rule-groups/$encoded" "$watchdog_body")
[[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
echo "OK"

# ════════════════════════════════════════════════════
# Step 6/6: Set notification policies
# ════════════════════════════════════════════════════
printf '[6/6] Setting notification policies... '

# Check current policies
LAST_HTTP_CODE=$(grafana_api GET /api/v1/provisioning/policies)
[[ "$LAST_HTTP_CODE" -eq 200 ]] || die

# Detect non-default policies (default has receiver "grafana-default-email" with no routes)
current_receiver=$(jq -r '.receiver // empty' "$_BODY_FILE")
current_routes=$(jq '.routes // [] | length' "$_BODY_FILE")

if [[ "$current_receiver" != "grafana-default-email" || "$current_routes" -gt 0 ]]; then
  echo ""
  echo "  WARNING: Non-default notification policies detected."
  echo "  Current root receiver: $current_receiver ($current_routes child routes)"
  echo "  This will REPLACE the entire notification policy tree."

  if [[ "$AUTO_CONFIRM" != "true" ]]; then
    if [[ -t 0 ]]; then
      read -rp "  Overwrite existing notification policies? [y/N] " confirm
      [[ "$confirm" =~ ^[yY] ]] || { echo "  Aborted."; exit 1; }
    else
      echo "  Non-interactive mode. Use --yes to auto-confirm. Aborting." >&2
      exit 1
    fi
  fi
  printf '  Deploying... '
fi

policy_body=$(jq -n '{
  receiver: "IronScout Slack",
  group_by: ["alertname", "severity"],
  routes: [
    {
      receiver: "IronScout Slack",
      object_matchers: [["severity", "=", "critical"]],
      group_wait: "10s",
      group_interval: "1m",
      repeat_interval: "1h"
    },
    {
      receiver: "IronScout Slack",
      object_matchers: [["severity", "=", "warning"]],
      group_wait: "30s",
      group_interval: "5m",
      repeat_interval: "4h"
    }
  ]
}')

LAST_HTTP_CODE=$(grafana_api PUT /api/v1/provisioning/policies "$policy_body")
[[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
echo "OK"

# ════════════════════════════════════════════════════
# Done
# ════════════════════════════════════════════════════
echo ""
echo "Done. 11 alert rules deployed. Verify at: ${GRAFANA_URL}/alerting/list"
