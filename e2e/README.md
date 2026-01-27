# E2E Tests (v1)

This folder holds Playwright UI smoke tests for web/admin/merchant.
Trust‑critical end‑to‑end coverage is defined in:
`context/reference/e2e-testing-plan.md`

## Run

```bash
pnpm test:e2e
```

## What these tests are

- Fast UI smoke for:
  - `e2e/web`
  - `e2e/admin`
  - `e2e/merchant` (internal tooling only; not a v1 ship gate)

## What these tests are not

- Full trust E2E (API + DB + workers).
- Any queue prefix capability (explicitly not added).

## Trust E2E (separate lane)

The trust suite should run the API with `NODE_ENV=production` and use an
isolated Postgres + Redis. See `context/reference/e2e-testing-plan.md`.
