# Fixtures

Required:
- in-stock fixture
- out-of-stock fixture
- one malformed/edge fixture
- meta.json with capturedAt/capturedFrom/capturedBy/notes

Rules:
- no live network in contract tests
- fixture outputs must be deterministic
- update expected hash only when normalization behavior intentionally changes
