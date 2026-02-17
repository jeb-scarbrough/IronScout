Vendored Font Licenses

This directory contains vendored font files used by `apps/www` via `next/font/local`.

Fonts:
- Outfit (`Outfit-Latin.woff2`, `Outfit-LatinExt.woff2`)
- JetBrains Mono (`JetBrainsMono-Latin.woff2`, `JetBrainsMono-LatinExt.woff2`)

License:
- SIL Open Font License 1.1 (OFL-1.1)
- https://openfontlicense.org

Upstream projects:
- Outfit: https://fonts.google.com/specimen/Outfit
- JetBrains Mono: https://www.jetbrains.com/lp/mono/

Notes:
- Fonts are vendored to eliminate build-time network dependency on Google Fonts.
- Files are emitted by Next.js under `/_next/static/media/*` with hashed names at build time.
