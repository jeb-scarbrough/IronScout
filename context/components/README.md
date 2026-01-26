# Component Specifications

This directory contains implementation-ready component specifications for IronScout UI components.

## Search Results Components

| Spec | Component | Status |
|------|-----------|--------|
| [result-card-v2-spec.md](./result-card-v2-spec.md) | `ResultCardV2` | Draft |
| [result-row-v2-spec.md](./result-row-v2-spec.md) | `ResultRowV2` | Draft |
| [retailer-panel-spec.md](./retailer-panel-spec.md) | `RetailerPanel` | Draft |

## Spec Structure

Each component spec includes:

1. **Purpose** — What the component does and why
2. **Props Interface** — TypeScript interface definition
3. **Visual Structure** — ASCII wireframe of layout
4. **Section Details** — Rules for each section/element
5. **States** — Loading, empty, error, edge cases
6. **Interactions** — Click handlers, triggers, navigation
7. **Removed** — Explicitly lists removed elements (vs previous version)
8. **Accessibility** — ARIA requirements
9. **Example Usage** — Code snippet

## How to Use

1. Read the parent spec first (e.g., `search-results-ux-spec.md`)
2. Implement component per the detailed spec
3. Verify against "Removed" list to ensure deprecated patterns are gone
4. Test all states documented

## Naming Convention

- Spec files: `{component-name}-spec.md`
- Components: PascalCase, matches spec name
- New versions: Suffix with `V2`, `V3` etc. until old version is removed
