# IronScout Design Audit — Execution Plan

**Generated:** February 4, 2026
**Scope:** 17 issues across 3 phases, plus design system prerequisites
**Approach:** Phase-gated. Each phase completes and verifies before the next begins.
**Prerequisites:** ADR-023 (Phase 0 Decisions) — Accepted

---

## Phase 0 Decisions (Resolved)

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Font pairing | Outfit (display + body) + JetBrains Mono (code/data) |
| D2 | Page headings | Remove all page h1s — sidebar/nav provides context |
| D3 | Light mode | Dark-only for v1 — remove toggle and light tokens |
| D4 | Dashboard layout | Route groups for clean layout separation |

See ADR-023 for rationale and alternatives considered.

---

## Phase 1 — Critical (Identity + Usability)

### Task 1.1 — Resolve Typography Conflict
- Update `globals.css` `:root` font variables to Outfit/JetBrains Mono
- Align `next/font` imports in `web/layout.tsx` and `www/layout.tsx`
- Remove unused font declarations
- Grep and replace hardcoded font-family references
- **Files:** `packages/ui/styles/globals.css`, `apps/web/app/layout.tsx`, `apps/www/app/layout.tsx`

### Task 1.2 — Remove Search Page Title
- Remove `<h1>Search</h1>` and subtitle from search page
- **Files:** `apps/web/app/search/page.tsx`

### Task 1.3 — Standardize Dashboard Heading
- Remove h1 from dashboard and all sub-pages (per D2)
- **Files:** `apps/web/app/dashboard/page.tsx` + sub-pages

### Task 1.4 — Fix Dashboard Layout Fragmentation
- Implement route groups per D4
- Remove `<style>` injection hack
- **Files:** `apps/web/app/` restructure — largest task in Phase 1

### Task 1.5 — Collapse Filters on Mobile
- Hide inline filters on mobile, add "Filters (N)" toggle button
- **Files:** `apps/web/components/search/unified-search.tsx`

### Task 1.6 — Unify Search Bar Between www and web
- Extract shared search bar component with pill-style + AI badge
- **Files:** `apps/www/app/page.tsx`, potentially `packages/ui/`

---

## Phase 2 — Refinement (Spacing + Color + Consistency)

### Task 2.1 — Reduce Result Card Noise
- Remove redundant "Prices across retailers" sub-header
- Combine caliber + grain + casing into single inline attribute line
- **Files:** `apps/web/components/results/result-card-v2.tsx`

### Task 2.2 — Neutralize Casing Badges
- Replace color-coded casing styles with single neutral treatment
- **Files:** `apps/web/components/results/result-card-v2.tsx`

### Task 2.3 — Uniform Quick-Start Chips
- Remove conditional `bg-primary` on first chip
- **Files:** `apps/web/components/search/unified-search.tsx`

### Task 2.4 — Establish Spacing Rhythm
- Standardize: `space-y-8` sections, `gap-6` grids, `p-6` card padding
- **Files:** dashboard, search, result cards, layout components

### Task 2.5 — Standardize Watch/Bookmark Button
- Adopt top-right compact Bookmark icon as universal pattern
- **Files:** `result-card-v2.tsx`, `retailer-panel.tsx`, empty-state cards

### Task 2.6 — Replace Hardcoded Sidebar Color
- Replace `bg-[#00C2CB]/10 text-[#00C2CB]` with `bg-primary/10 text-primary`
- **Files:** `apps/web/components/layout/sidebar-nav.tsx`

### Task 2.7 — Simplify Footer
- Replace 4-column grid with single-row layout
- **Files:** `apps/web/components/layout/footer.tsx`

---

## Phase 3 — Polish (Micro-interactions + States)

### Task 3.1 — Trim Empty Search Chips
- Reduce to 3–4 primary chips, remove "Advanced searches" section
- **Files:** `apps/web/components/search/unified-search.tsx`

### Task 3.2 — Standardize Loading Skeletons
- Audit and unify all skeleton/loading patterns
- **Files:** result cards, search, dashboard skeleton components

### Task 3.3 — Add Accordion Animation (www)
- Replace instant show/hide with CSS transition (200ms ease-out)
- **Files:** `apps/www/app/page.tsx`

### Task 3.4 — Warm Error State Copy
- Replace generic error messages with brand-voice copy
- **Files:** `apps/web/components/search/search-results.tsx`

### Task 3.5 — Commit to Dark-Only
- Remove light-mode CSS variables and ThemeToggle component (per D3)
- **Files:** `packages/ui/styles/globals.css`, `apps/web/app/providers.tsx`

### Task 3.6 — Evaluate Noise/Grid Overlays
- Screenshot test at 1:1 pixel zoom; remove if imperceptible
- **Files:** `packages/ui/styles/globals.css`, `apps/www/app/page.tsx`, auth layouts

---

## Summary

| Phase | Tasks | Estimated Files | Estimated Lines |
|-------|-------|----------------|----------------|
| 1 — Critical | 6 | 8–15 | ~150–200 |
| 2 — Refinement | 7 | 10–15 | ~100–130 |
| 3 — Polish | 6 | 10–15 | ~80–100 |
| **Total** | **19** | **~30–40** | **~330–430** |
