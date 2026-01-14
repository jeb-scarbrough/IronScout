# Affiliate Feed Test Fixtures

These CSVs are generated fixtures for affiliate feed testing. They are designed
to be realistic enough to stress the harvester while keeping deterministic
counts for verification.

Artifacts:
- `expectations.json`: counts per file (parsed, rejected, quarantined, needsResolver, URL_HASH fallback, duplicate identity).
- `scripts/dev/generate-test-affiliate-feeds.mjs`: generator used to rebuild all files.

Regenerate:
```
node scripts/dev/generate-test-affiliate-feeds.mjs
```

Notes:
- "rejected" rows fail parse validation (missing name/url, invalid url, invalid price).
- "quarantined" rows parse but are missing caliber.
- "needsResolver" rows omit UPC/GTIN to force resolver enqueue.
- "urlHashFallback" rows omit catalog item id + sku so URL_HASH is the identity.
