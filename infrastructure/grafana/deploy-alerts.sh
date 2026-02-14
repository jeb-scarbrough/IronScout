#!/usr/bin/env bash
# deploy-alerts.sh — Deploy IronScout Grafana alerts via HTTP API
# Source of truth: infrastructure/grafana/provisioning/alerting/*.yaml
#
# All alert rules, contact points, templates, and notification policies are
# read from the YAML files — the script never hardcodes alert definitions.
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
command -v yq   >/dev/null 2>&1 || { echo "ERROR: yq is required but not installed. Install: https://github.com/mikefarah/yq" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YAML_DIR="$SCRIPT_DIR/provisioning/alerting"

FOLDER_UID="ironscout-alerts"
FOLDER_TITLE="IronScout Alerts"

# Verify YAML source files exist
for f in ironscout-alerts.yaml ironscout-contact-points.yaml ironscout-templates.yaml ironscout-notification-policies.yaml; do
  [[ -f "$YAML_DIR/$f" ]] || { echo "ERROR: Missing $YAML_DIR/$f" >&2; exit 1; }
done

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

# Convert Grafana duration string to seconds (e.g., "1m" → 60, "5m" → 300)
parse_interval() {
  local val="${1%[smh]}"
  local unit="${1: -1}"
  case "$unit" in
    s) echo "$val" ;;
    m) echo "$((val * 60))" ;;
    h) echo "$((val * 3600))" ;;
    *) echo "ERROR: Unknown interval unit in '$1'" >&2; exit 1 ;;
  esac
}

# Substitute env var placeholders in a JSON string.
# Replaces ${LOKI_DATASOURCE_UID} with resolved Loki UID and ${GRAFANA_URL}.
subst_vars() {
  sed "s|\${LOKI_DATASOURCE_UID}|$LOKI_UID|g; s|\${GRAFANA_URL}|$GRAFANA_URL|g; s|\${SLACK_DATAFEED_ALERTS_WEBHOOK_URL}|$SLACK_DATAFEED_ALERTS_WEBHOOK_URL|g"
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
# Step 3/6: Create contact point (from YAML)
# ════════════════════════════════════════════════════
CP_NAME=$(yq '.contactPoints[0].name' "$YAML_DIR/ironscout-contact-points.yaml")
printf '[3/6] Creating contact point "%s"... ' "$CP_NAME"

LAST_HTTP_CODE=$(grafana_api GET /api/v1/provisioning/contact-points)
[[ "$LAST_HTTP_CODE" -eq 200 ]] || die

existing_cp_uid=$(jq -r --arg name "$CP_NAME" \
  '[.[] | select(.name == $name)][0].uid // empty' "$_BODY_FILE")

# Extract settings from YAML, substitute env vars
CP_SETTINGS=$(yq -o=json '.contactPoints[0].receivers[0].settings' "$YAML_DIR/ironscout-contact-points.yaml" | subst_vars)

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
# Step 4/6: Create message template (from YAML)
# ════════════════════════════════════════════════════
TMPL_NAME=$(yq '.templates[0].name' "$YAML_DIR/ironscout-templates.yaml")
printf '[4/6] Creating message template "%s"... ' "$TMPL_NAME"

tmpl_body=$(yq -o=json '.templates[0] | {name, template}' "$YAML_DIR/ironscout-templates.yaml")

LAST_HTTP_CODE=$(grafana_api PUT "/api/v1/provisioning/templates/$TMPL_NAME" "$tmpl_body")
[[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
echo "OK"

# ════════════════════════════════════════════════════
# Step 5/6: Create alert rule groups (from YAML)
# ════════════════════════════════════════════════════
echo '[5/6] Creating alert rule groups...'

ALERTS_YAML="$YAML_DIR/ironscout-alerts.yaml"
group_count=$(yq '.groups | length' "$ALERTS_YAML")
total_rules=0

for ((i=0; i<group_count; i++)); do
  group_name=$(yq ".groups[$i].name" "$ALERTS_YAML")
  interval_str=$(yq ".groups[$i].interval" "$ALERTS_YAML")
  interval_secs=$(parse_interval "$interval_str")
  rule_count=$(yq ".groups[$i].rules | length" "$ALERTS_YAML")
  total_rules=$((total_rules + rule_count))

  printf '  - %s (%d rules)... ' "$group_name" "$rule_count"

  # Convert rules from YAML to JSON, substitute env var placeholders,
  # then add ruleGroup/folderUID fields required by the provisioning API.
  rules_json=$(
    yq -o=json ".groups[$i].rules" "$ALERTS_YAML" | \
    subst_vars | \
    jq --arg folder "$FOLDER_UID" --arg group "$group_name" \
      '[.[] | . + {ruleGroup: $group, folderUID: $folder}]'
  )

  group_body=$(jq -n \
    --arg title "$group_name" \
    --arg folder "$FOLDER_UID" \
    --argjson interval "$interval_secs" \
    --argjson rules "$rules_json" \
    '{ title: $title, folderUid: $folder, interval: $interval, rules: $rules }')

  encoded=$(urlencode "$group_name")
  LAST_HTTP_CODE=$(grafana_api PUT "/api/v1/provisioning/folder/$FOLDER_UID/rule-groups/$encoded" "$group_body")
  [[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
  echo "OK"
done

# ════════════════════════════════════════════════════
# Step 6/6: Set notification policies (from YAML)
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

# Convert provisioning YAML matchers ("severity=critical") to API object_matchers
# format ([["severity", "=", "critical"]]) and build the policy body.
policy_body=$(
  yq -o=json '.policies[0]' "$YAML_DIR/ironscout-notification-policies.yaml" | \
  jq '{
    receiver,
    group_by,
    routes: [.routes[] | {
      receiver,
      object_matchers: [.matchers[] | capture("^(?<k>[^=!~]+)(?<op>=~|!=|!~|=)(?<v>.*)$") | [.k, .op, .v]],
      group_wait,
      group_interval,
      repeat_interval
    }]
  }'
)

LAST_HTTP_CODE=$(grafana_api PUT /api/v1/provisioning/policies "$policy_body")
[[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]] || die
echo "OK"

# ════════════════════════════════════════════════════
# Done
# ════════════════════════════════════════════════════
echo ""
echo "Done. $total_rules alert rules deployed across $group_count groups. Verify at: ${GRAFANA_URL}/alerting/list"
