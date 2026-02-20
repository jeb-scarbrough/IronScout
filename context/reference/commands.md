# Commands

This document lists the **canonical commands** for working with the IronScout codebase.
It is written for humans and coding agents.

Rules:
- Prefer workspace-wide commands where possible
- Avoid undocumented one-off scripts
- If a command is required, it must appear here

If this document conflicts with package.json scripts, package.json wins.

---

## Package Manager

IronScout uses a **pnpm monorepo**.

All examples use `pnpm`.

---

## Install

```bash
pnpm install
```

---

## Local Development

### Run all apps (if supported)

```bash
pnpm dev
```

---

### API

```bash
cd apps/api
pnpm dev
```

---

### Consumer Web

```bash
cd apps/web
pnpm dev
```

---

### Merchant Portal

```bash
cd apps/merchant
pnpm dev
```

---

### Admin Portal

```bash
cd apps/admin
pnpm dev
```

---

### Harvester

⚠️ Scheduler must be singleton (controlled via Admin Settings).

```bash
cd apps/harvester
pnpm dev
```

Note: Scheduler enabled/disabled state is controlled via Admin UI (Settings > Danger Zone).
For local dev, the database setting typically defaults to `false`. Use Admin UI to toggle.

---

### Bull Board (Queue Monitor)

Ops-only dashboard for monitoring BullMQ queues. Protected by HTTP Basic Auth.

```bash
cd apps/harvester
BULLBOARD_USERNAME=admin BULLBOARD_PASSWORD=<strong-password> pnpm bullboard:dev
```

Access at: `http://localhost:3939/admin/queues`

⚠️ **Security:**
- Never expose to the public internet
- Run behind firewall or VPN only
- Use strong, unique credentials
- See `context/02_monitoring_and_observability.md` for full documentation

---

## Scraper Workflow

### Plugin Onboarding (ingestion/scrape)

```bash
pnpm scraper:add --site-id <siteId> --name "<display name>" --mode html|json [--owner "<owner>"]
pnpm scraper:validate --site-id <siteId> [--strict]
pnpm scraper:test --site-id <siteId>
pnpm scraper:smoke --site-id <siteId> --url-file <urls.txt> [--limit 10]
pnpm scraper:db:add-retailer-source --site-id <siteId> --retailer-name "<name>" --website "https://..." --source-name "<name>" --source-url "https://..."
```

`scraper:db:add-retailer-source` is text-only: it validates inputs and prints a SQL upsert script. It does not read or write the database.

See `context/reference/scraper-onboarding.md` for full onboarding checklist and Admin bulk import requirements.

### Legacy Adapter Workflow (scraper/adapters)

```bash
pnpm scraper:bootstrap --id <adapterId> --domain <domain>
pnpm scraper:new --id <adapterId> --domain <domain> --version 0.1.0
pnpm scraper:discover --source-url <url> --listing <url> --product-path-prefix /ammo/ --dry-run
pnpm scraper:dry-run --adapter-id <adapterId> --url-file <urls.txt> --limit 10
```

Note: `scraper:dry-run` uses the harvester dist build. If it is missing, run:

```bash
pnpm --filter @ironscout/harvester build
```

---

## Database

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

---

## Tests

```bash
pnpm test
```

---

## Linting & Formatting

```bash
pnpm lint
pnpm format
```

---

## Build

```bash
pnpm build
```

---

## Guiding Principle

> If an action is common, it must be scripted.
