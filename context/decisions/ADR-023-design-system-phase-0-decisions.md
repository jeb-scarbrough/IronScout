# ADR-023: Design System Phase 0 Decisions

**Status:** Accepted
**Date:** 2026-02-04
**Owners:** Product, UX
**Related Docs:** [UX Charter](../06_ux_charter.md), [Design Audit Execution Plan](../design-audit-execution-plan.md)

---

## Context

A comprehensive design audit identified 17 issues across typography, layout, spacing, color, and interaction patterns. Four foundational decisions must be resolved before any implementation begins, as each gates multiple downstream tasks.

These decisions address conflicts and ambiguities in the current design system that, left unresolved, would cause rework during implementation.

---

## Decisions

### D1: Font Pairing

**Decision:** Outfit (display + body) + JetBrains Mono (code/data).

Outfit serves as the single sans-serif for both display headings and body text. JetBrains Mono handles monospace contexts (prices, data tables, code).

**Rationale:** The codebase currently has a conflict — `globals.css` declares Oswald/Source Sans 3 while `layout.tsx` imports Outfit/JetBrains Mono via `next/font`. This collision produces unpredictable rendering. Outfit was chosen because it is already loaded by the application runtime and provides sufficient weight range (400–900) for both heading and body hierarchy.

**Consequences:**
- `globals.css` `:root` font variables must be updated to reference Outfit
- Oswald and Source Sans 3 declarations must be removed
- All hardcoded `font-family` references must use token variables

### D2: Page Headings

**Decision:** Remove all page h1 headings. Sidebar navigation provides sufficient context.

**Rationale:** Page-level h1s compete with primary interaction elements (e.g., `<h1>Search</h1>` competes with the search bar). The sidebar already indicates the active page. Removing headings eliminates visual noise and gives primary UI elements uncontested focus.

**Consequences:**
- Remove h1 elements from search page, dashboard, and all dashboard sub-pages
- Sidebar active state becomes the sole page-context indicator
- Accessibility: ensure `<title>` and aria-labels provide equivalent context for screen readers

### D3: Light Mode

**Decision:** Dark-only for v1. Remove theme toggle and light-mode token declarations.

**Rationale:** Light mode exists in the token system but has never been designed for. The auth layout force-sets dark theme. The marketing site is always dark. A half-designed light mode creates distrust and doubles QA surface for no user value at launch.

**Consequences:**
- Remove ThemeToggle component and theme switching logic
- Remove or comment out `:root` light-mode CSS variables
- Reduces QA surface and eliminates an entire class of visual bugs
- Light mode can be revisited post-launch with a proper design pass

### D4: Dashboard Layout Strategy

**Decision:** Route groups — `/app/(app)/` vs `/app/(dashboard)/` for clean layout separation.

**Rationale:** The dashboard currently hides the global header/footer via injected `<style>` tags with `display: none !important`. This is fragile, causes Flash of Unstyled Content (FOUC), and will break unpredictably. Route groups are the idiomatic Next.js solution for pages that need different layout shells.

**Consequences:**
- Consumer pages (search, products, retailers, pricing) move to `(app)/` route group with Header + Footer
- Dashboard pages move to `(dashboard)/` route group with SidebarNav only
- Root layout provides only html/body shell, fonts, and providers
- Auth pages continue to use MarketingHeader via their own layout
- Largest structural change in the design audit — must be done early to avoid rework

---

## Alternatives Considered

| Decision | Alternative | Why Rejected |
|----------|-----------|--------------|
| D1 | Oswald display / Source Sans 3 body | Not loaded by `next/font` runtime — would require additional migration |
| D2 | Keep h1s but standardize style | Still competes with primary UI; removal is cleaner |
| D3 | Keep light mode and audit every screen | Doubles QA surface for zero user demand pre-launch |
| D4 | Conditional rendering based on pathname | Fragile string matching; doesn't leverage Next.js layout system |

---

## Enforcement

All Phase 1–3 design audit implementation must conform to these decisions. Any deviation requires a new ADR superseding the relevant section.

---

## Notes

These decisions were identified during a full-codebase design audit. The audit execution plan defines 3 implementation phases (Critical, Refinement, Polish) totaling ~17 tasks across ~30–40 files. This ADR gates all subsequent work.
