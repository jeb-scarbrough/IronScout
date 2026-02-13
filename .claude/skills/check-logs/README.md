# /check-logs

On-demand AI-powered log health investigation via Grafana/Loki.

## Prerequisites

### Grafana Service Account Token

1. Open Grafana (default: `http://10.10.9.28:3001`)
2. Go to **Administration > Service Accounts**
3. Create a new service account with **Viewer** role
4. Generate a token (prefix: `glsa_`)
5. Set the environment variable:
   ```bash
   export GRAFANA_SA_TOKEN="glsa_your_token_here"
   ```

Never commit this token to any file.

## Usage

```
/check-logs          # Last 24 hours (default)
/check-logs 1h       # Last 1 hour
/check-logs 6h       # Last 6 hours
/check-logs 3d       # Last 3 days
```

## What It Does

- Queries Loki for errors, fatals, warnings, restarts, and pipeline health
- Fetches sample log lines for any category with hits
- Compares current counts to a baseline window for novelty detection ([NEW], [SPIKE], [RECURRING])
- Produces a structured health report with severity classification
- Tracks query coverage and flags partial observability

## What It Does NOT Do

- Does not change any code or infrastructure
- Does not create dashboards or alert rules
- Does not auto-remediate or take any corrective action
- Does not access databases directly (Loki queries only)

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GRAFANA_SA_TOKEN` | Yes | - | Service account token (Viewer role) |
| `GRAFANA_URL` | No | `http://10.10.9.28:3001` | Grafana base URL |
| `LOKI_DATASOURCE_UID` | No | `loki` | Loki datasource UID (resolved at runtime) |

## Known Blind Spots

These signals are not available in Loki and cannot be detected by this skill:

1. **Payment failures** - Tracked via DB audit writes to `admin_audit_logs`, not log events
2. **Auth login success rate** - Logged as plain messages without `event_name`; regex may miss edge cases
3. **Queue backlog depth** - BullMQ queue depth/stalled jobs not emitted as log events; check Bull Board manually
4. **Degraded ingest runs** - `INGEST_RUN_SUMMARY` with `status: 'SUCCESS'` but low `pricesWritten` or high `quarantineRate` is not flagged automatically
