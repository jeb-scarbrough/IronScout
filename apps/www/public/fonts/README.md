These fonts are vendored for deterministic `apps/www` builds.

Why:
- `next/font/google` requires network access during build.
- CI must build without external network assumptions.

How they are used:
- `apps/www/app/layout.tsx` loads these files via `next/font/local`.
- `Outfit-*` powers `--font-display`.
- `JetBrainsMono-*` powers `--font-mono`.

If typography changes, update this folder and `apps/www/app/layout.tsx` together.
