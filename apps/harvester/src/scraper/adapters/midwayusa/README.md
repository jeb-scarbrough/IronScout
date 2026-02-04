# midwayusa Adapter

Domain: midwayusa.com


Copy this folder to `apps/harvester/src/scraper/adapters/<retailer>/` and replace:

- `adapter.ts` constants (`ADAPTER_ID`, `ADAPTER_VERSION`, `ADAPTER_DOMAIN`)
- `selectors.ts` with real CSS selectors
- `__tests__/fixtures/*` with real HTML snapshots
- `__tests__/adapter.test.ts` and remove `.skip` after selectors are real

Checklist reference: `apps/harvester/src/scraper/adapters/RETAILER_INTAKE_CHECKLIST.md`
