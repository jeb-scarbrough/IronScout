# Affiliate Feeds Go-Live Runbook

## Apply Database Migrations
1) Run all Prisma migrations.
2) Apply manual SQL in order:
   - `packages/db/migrations/20251228_affiliate_feed_constraints.sql`
   - `packages/db/migrations/20251228_backfill_source_fields.sql`
3) Verify constraints with the psql script in `context/operations/affiliate_feeds_verify.sql`.

## Environment Configuration
- `CREDENTIAL_ENCRYPTION_KEY_B64`: Base64-encoded 32-byte key (required).
- `AFFILIATE_FEED_ALLOW_PLAIN_FTP`: Prefer `false`; set `true` only if insecure FTP is explicitly allowed.
- `HARVESTER_SCHEDULER_ENABLED=true` and `AFFILIATE_FEED_SCHEDULER_ENABLED=true` on exactly **one** instance (singleton scheduler).
- Worker-only instances: `HARVESTER_SCHEDULER_ENABLED=false`.

## Startup Steps
- Warm DB/Redis connections.
- Start harvester on the scheduler host.
- Start additional worker-only instances as needed.

## Verification (psql)
Run: `psql $DATABASE_URL -f context/operations/affiliate_feeds_verify.sql`

## Smoke Tests
- Create an IMPACT feed (CSV, GZIP if applicable) with `expiryHours` between 1–168.
- Trigger a manual run; expect RUNNING → SUCCEEDED; `manualRunPending` cleared.
- Confirm `prices_written` > 0 and no duplicate prices (partial unique holds).
- Simulate a URL_HASH spike; expect `expiryBlocked` with reason; approval requires advisory lock and is blocked if a newer SUCCEEDED run exists.

## Monitoring
- Logs: `RUN_START/COMPLETE`, `CIRCUIT_BREAKER_*`, `FEED_AUTO_DISABLED`, `SKIPPED_LOCK_BUSY/MANUAL_RUN_DEFERRED`.
- Slack alerts: run failures, circuit-breaker blocks, auto-disable.
- BullMQ: only one repeatable `affiliate-feed-scheduler-tick` job present.

## Safety and Recovery
- Ensure only one scheduler instance is active.
- Investigate any RUNNING runs that remain stuck (lock conflicts).
- Rollback: stop scheduler host; remove repeatable scheduler job if misconfigured; re-enable after fixes.
