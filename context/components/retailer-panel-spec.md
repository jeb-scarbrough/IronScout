# RetailerPanel Component Specification

**Status:** Draft
**Component:** `apps/web/components/results/retailer-panel.tsx`
**New Component**
**Parent Spec:** `search-results-ux-spec.md`

---

## Purpose

Slide-over drawer displaying all retailer prices for a single product. Enables comprehensive multi-retailer comparison without leaving search results.

Primary action: View individual retailer listings to compare shipping, stock, and final price.

---

## Props Interface

```typescript
interface RetailerPanelProps {
  // Panel state
  isOpen: boolean
  onClose: () => void

  // Product data
  product: {
    id: string
    name: string
    caliber: string
    bulletType?: string
    grainWeight?: number
    caseMaterial?: string
    roundCount: number
  }

  // Retailers (unsorted - panel handles sorting)
  retailers: RetailerPrice[]

  // User state
  isWatched: boolean
  onWatchToggle: (productId: string) => void
}

interface RetailerPrice {
  retailerId: string
  retailerName: string
  pricePerRound: number
  totalPrice: number
  inStock: boolean
  shippingInfo: ShippingInfo
  url: string
  lastUpdated?: string // ISO date string
}

type ShippingInfo =
  | { type: 'included' }
  | { type: 'excluded'; amount: number }
  | { type: 'excluded_unknown' }
  | { type: 'free_over'; threshold: number }
  | { type: 'pickup_only' }
  | { type: 'unknown' }
```

---

## Visual Structure

```
┌─────────────────────────────────────┐
│ HEADER                              │
│  └─ Back button (left)              │
│  └─ Watch button (right)            │
├─────────────────────────────────────┤
│ PRODUCT SUMMARY                     │
│  └─ Title                           │
│  └─ Attributes line                 │
├─────────────────────────────────────┤
│ CONTROLS                            │
│  └─ Retailer count                  │
│  └─ Sort dropdown                   │
│  └─ Hide OOS checkbox               │
├─────────────────────────────────────┤
│ RETAILER LIST (scrollable)          │
│  └─ RetailerRow × N                 │
├─────────────────────────────────────┤
│ FOOTER                              │
│  └─ View Product Details link       │
└─────────────────────────────────────┘
```

---

## Panel Dimensions

| Viewport | Width | Position |
|----------|-------|----------|
| Desktop (1024+) | 420px | Right drawer |
| Tablet (768-1023) | 360px | Right drawer |
| Mobile (<768) | 100% | Full-screen modal |

Animation: Slide in from right (drawer) or bottom (mobile modal).

---

## Sections

### Header

```
┌─────────────────────────────────────┐
│ ← Back                     [Watch]  │
└─────────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| Back button | `← Back` text + icon, calls `onClose()` |
| Watch button | Same as card, toggles watch state |

On mobile, Back becomes `✕` close icon.

### Product Summary

```
┌─────────────────────────────────────┐
│ Federal American Eagle 9mm          │
│ 115gr · FMJ · Brass · 50 rounds     │
└─────────────────────────────────────┘
```

| Element | Style |
|---------|-------|
| Title | `font-semibold text-lg`, max 2 lines |
| Attributes | `text-muted-foreground text-sm`, dot-separated |

Attribute order: `{grainWeight}gr · {bulletType} · {caseMaterial} · {roundCount} rounds`

Omit missing attributes, no trailing dots.

### Controls

```
┌─────────────────────────────────────┐
│ 8 retailers · Sort: [Price ▼]       │
│ □ Hide out of stock                 │
└─────────────────────────────────────┘
```

| Element | Type | Options |
|---------|------|---------|
| Retailer count | Static text | "{N} retailers" or "1 retailer" |
| Sort dropdown | Select | See Sort Options |
| Hide OOS | Checkbox | Filters list client-side |

#### Sort Options

| Option | Sort Logic |
|--------|------------|
| Price (low-high) | `pricePerRound ASC` — **Default** |
| Price (high-low) | `pricePerRound DESC` |
| Retailer A-Z | `retailerName ASC` |
| In-stock first | `inStock DESC`, then `pricePerRound ASC` |

**Not included:**
- ~~"Best value"~~ — Implies recommendation
- ~~"Recommended"~~ — Violates neutrality

### Retailer List

Scrollable container with RetailerRow components.

#### RetailerRow Anatomy

```
┌─────────────────────────────────────┐
│ Palmetto State Armory               │
│ $0.30/rd · $14.99 (50 rounds)       │
│ In Stock · Free shipping $99+       │
│                             [View →]│
└─────────────────────────────────────┘
```

| Element | Style | Rules |
|---------|-------|-------|
| Retailer Name | `font-medium text-foreground` | Full name, no truncation |
| $/rd | `font-mono font-bold text-lg` | Primary metric |
| Total | `text-muted-foreground` | Format: `$X.XX ({roundCount} rounds)` |
| Stock | Green or Red text | "In Stock" or "Out of Stock" |
| Shipping | `text-muted-foreground text-sm` | Per ShippingInfo format |
| View button | `variant="ghost" size="sm"` | Opens retailer URL |

**Shipping Display:**

| ShippingInfo.type | Display |
|-------------------|---------|
| included | "Shipping included" |
| excluded | `+$${amount} shipping` |
| excluded_unknown | "+ shipping (varies)" |
| free_over | `Free shipping $${threshold}+` |
| pickup_only | "In-store pickup only" |
| unknown | (no shipping line) |

**Out-of-Stock Rows:**
- `opacity-60`
- Appear at bottom when sorted by price
- Still show last-known price
- View button still functional

### Footer

```
┌─────────────────────────────────────┐
│     [View Product Details]          │
└─────────────────────────────────────┘
```

Ghost button linking to `/products/{id}`.

Only shown if product detail page exists.

---

## States

### Loading

Show skeleton while fetching retailer data:

```
┌─────────────────────────────────────┐
│ ← Back                     [Watch]  │
├─────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
│ ▓▓▓▓▓▓▓▓▓▓▓▓ · ▓▓▓ · ▓▓▓▓▓          │
├─────────────────────────────────────┤
│ Loading...                          │
├─────────────────────────────────────┤
│ [skeleton row] × 5                  │
└─────────────────────────────────────┘
```

### Empty (No Retailers)

```
┌─────────────────────────────────────┐
│ Product Title                       │
│ Attributes...                       │
├─────────────────────────────────────┤
│                                     │
│       No current listings           │
│                                     │
│   We haven't found this product     │
│   at any tracked retailer recently. │
│                                     │
│      [Watch for availability]       │
│                                     │
└─────────────────────────────────────┘
```

CTA triggers `onWatchToggle` if not already watched.

### All Filtered Out

When "Hide out of stock" is checked and all are OOS:

```
┌─────────────────────────────────────┐
│ 8 retailers · Sort: [Price ▼]       │
│ ☑ Hide out of stock                 │
├─────────────────────────────────────┤
│                                     │
│   All 8 retailers are out of stock  │
│                                     │
│      [ Show all retailers ]         │
│                                     │
└─────────────────────────────────────┘
```

Button unchecks the filter.

---

## Interactions

| Trigger | Action |
|---------|--------|
| Back/Close button | Call `onClose()`, animate out |
| Overlay click (desktop) | Call `onClose()` |
| Escape key | Call `onClose()` |
| Watch button | Call `onWatchToggle(product.id)` |
| Sort change | Re-sort list client-side |
| Hide OOS toggle | Filter list client-side |
| View button (row) | Open `retailer.url` in new tab |
| Product Details link | Navigate to `/products/{id}` |

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Focus trap | Focus stays within panel when open |
| Escape to close | `onKeyDown` handler |
| Announced on open | `role="dialog" aria-labelledby="panel-title"` |
| Retailer list | `role="list"` with `role="listitem"` children |
| Sort control | `aria-label="Sort retailers by"` |

---

## Animation

```css
/* Drawer (desktop/tablet) */
.panel-enter {
  transform: translateX(100%);
}
.panel-enter-active {
  transform: translateX(0);
  transition: transform 200ms ease-out;
}
.panel-exit-active {
  transform: translateX(100%);
  transition: transform 150ms ease-in;
}

/* Modal (mobile) */
.panel-enter {
  transform: translateY(100%);
}
/* etc. */
```

Use Radix Dialog or Headless UI Sheet for implementation.

---

## Example Usage

```tsx
<RetailerPanel
  isOpen={panelProduct !== null}
  onClose={() => setPanelProduct(null)}
  product={{
    id: panelProduct.id,
    name: panelProduct.name,
    caliber: panelProduct.caliber,
    bulletType: panelProduct.bulletType,
    grainWeight: panelProduct.grainWeight,
    caseMaterial: panelProduct.caseMaterial,
    roundCount: panelProduct.roundCount,
  }}
  retailers={panelProduct.retailers}
  isWatched={watchedIds.has(panelProduct.id)}
  onWatchToggle={handleWatch}
/>
```

---

## Data Flow

```
SearchResultsGrid
  └─ manages panelProductId state
  └─ on card/row "Compare" click:
      └─ set panelProductId
      └─ fetch full retailer list if not cached

RetailerPanel
  └─ receives product + retailers as props
  └─ manages sort/filter state internally
  └─ renders RetailerRow for each retailer
```

Retailer data may be:
1. **Inline with product** (if always fetched)
2. **Lazy loaded** (fetch on panel open)

Prefer inline if retailer count is typically ≤10.
Use lazy loading if products commonly have 20+ retailers.
