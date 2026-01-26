# ResultCard v2 Component Specification

**Status:** Draft
**Component:** `apps/web/components/results/result-card-v2.tsx`
**Replaces:** `result-card.tsx`
**Parent Spec:** `search-results-ux-spec.md`

---

## Purpose

Display a product card with **inline multi-retailer comparison** for search results discovery mode.

Primary goal: Enable quick price comparison across retailers without leaving the search grid.

---

## Props Interface

```typescript
interface ResultCardV2Props {
  // Product identity
  id: string
  productTitle: string

  // Attributes
  caliber: string
  bulletType?: string
  grainWeight?: number
  caseMaterial?: string
  roundCount?: number

  // Retailer prices (pre-sorted by pricePerRound ASC)
  retailers: RetailerPrice[]

  // User state
  isWatched: boolean
  onWatchToggle: (productId: string) => void

  // Panel trigger
  onCompareClick: (productId: string) => void
}

interface RetailerPrice {
  retailerId: string
  retailerName: string
  pricePerRound: number
  totalPrice: number
  inStock: boolean
  shippingInfo: ShippingInfo
  url: string
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
│  └─ Watch button (top-right)        │
│  └─ Product title                   │
│  └─ Attribute badges                │
├─────────────────────────────────────┤
│ RETAILER COMPARISON BLOCK           │
│  └─ RetailerRow × 3 (max inline)    │
│  └─ Overflow indicator              │
├─────────────────────────────────────┤
│ FOOTER                              │
│  └─ Compare CTA                     │
└─────────────────────────────────────┘
```

---

## Sections

### Header

| Element | Rules |
|---------|-------|
| Watch Button | Top-right corner, `position: absolute` |
| Product Title | `font-semibold`, max 2 lines, truncate |
| Attribute Badges | Horizontal flex-wrap, gap-1.5 |

**Watch Button States:**

| State | Icon | Label | Style |
|-------|------|-------|-------|
| Not watched | `Bookmark` outline | "Watch" | muted |
| Watched | `Bookmark` filled | "Watching" | primary |

### Attribute Badges

Display order (left to right):
1. Caliber (always, filled style)
2. Bullet Type (if available, outline)
3. Grain Weight (if available, outline, format: `{n}gr`)
4. Case Material (if available, color-coded)

**Case Material Colors:**
- Brass: `bg-amber-500/20 text-amber-600`
- Steel: `bg-muted text-muted-foreground`
- Other: `bg-muted text-muted-foreground`

**Caps:** Maximum 4 badges. If more attributes exist, stop at 4.

### Retailer Comparison Block

#### Inline Rows

| Retailer Count | Display |
|----------------|---------|
| 0 | "No listings found" empty state |
| 1 | Single row, no overflow |
| 2-3 | All rows |
| 4-5 | Top 3 rows + "+N more" link |
| 6+ | Top 3 rows + "Compare all N" link |

#### Inline Retailer Row

```
┌─────────────────────────────────────┐
│ RetailerName        $0.32/rd    $16 │
│ In Stock · Free over $99            │
└─────────────────────────────────────┘
```

| Element | Style | Rules |
|---------|-------|-------|
| Retailer Name | `font-medium` | Max 20 chars, truncate |
| $/rd | `font-mono font-bold` | Always show |
| Total | `text-muted-foreground text-sm` | Show if roundCount known |
| Stock | Green/Red text | "In Stock" or "Out of Stock" |
| Shipping | `text-muted-foreground text-xs` | Per ShippingInfo format |

**Shipping Format:**

| ShippingInfo.type | Display Text |
|-------------------|--------------|
| included | "delivered" (after $/rd) |
| excluded | `+$${amount} ship` |
| excluded_unknown | "+ shipping" |
| free_over | `Free ship $${threshold}+` |
| pickup_only | "Pickup only" |
| unknown | (nothing) |

#### Overflow Indicator

| Condition | Text | Action |
|-----------|------|--------|
| 4-5 retailers | "+{N} more" | Clicks trigger onCompareClick |
| 6+ retailers | "Compare all {N}" | Clicks trigger onCompareClick |

Style: `text-primary text-sm underline-offset-4 hover:underline`

### Footer CTA

| Retailer Count | CTA Text | Variant |
|----------------|----------|---------|
| 0 | "Watch for availability" | outline, disabled |
| 1 | "View at {RetailerName}" | outline |
| 2+ | "Compare {N} prices" | default |

---

## States

### Loading

```tsx
<ResultCardV2Skeleton />
```

Placeholder structure:
- Title bar (h-5, w-3/4)
- 4 badge placeholders (h-5, varying widths)
- 3 row placeholders (h-12 each)
- CTA placeholder (h-10, full width)

### Empty (No Retailers)

```
┌─────────────────────────────────────┐
│ Product Title                       │
│ [badges]                            │
│                                     │
│     No current listings             │
│     Check back later                │
│                                     │
│ [  Watch for availability  ]        │
└─────────────────────────────────────┘
```

### All Out of Stock

- Show all rows with muted opacity (60%)
- Stock status shows "Out of Stock" on each
- CTA changes to "View last prices" (outline)

---

## Interactions

| Trigger | Action |
|---------|--------|
| Click Watch button | Call `onWatchToggle(id)` |
| Click retailer row | Open `retailer.url` in new tab |
| Click overflow link | Call `onCompareClick(id)` |
| Click footer CTA | Call `onCompareClick(id)` or open single retailer URL |

---

## Removed (vs v1)

| Element | Reason |
|---------|--------|
| `isBestPrice` prop | Implies recommendation |
| `badges` prop (CardBadge[]) | Context badges violate neutrality |
| Price scaling/highlighting | Visual recommendation |
| Timestamp display | Creates false urgency |
| Single retailer as primary | Now shows inline comparison |

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Watch button label | `aria-label="Add to watchlist"` / `"Remove from watchlist"` |
| Retailer rows | Each row is `role="button"` with `aria-label="View at {name}"` |
| Overflow link | Standard link semantics |
| Focus order | Watch → Rows (top to bottom) → Overflow → CTA |

---

## Example Usage

```tsx
<ResultCardV2
  id="prod-123"
  productTitle="Federal American Eagle 9mm 115gr FMJ 50 Round Box"
  caliber="9mm"
  bulletType="FMJ"
  grainWeight={115}
  caseMaterial="Brass"
  roundCount={50}
  retailers={[
    {
      retailerId: "r1",
      retailerName: "Palmetto State Armory",
      pricePerRound: 0.30,
      totalPrice: 14.99,
      inStock: true,
      shippingInfo: { type: 'free_over', threshold: 99 },
      url: "https://palmetto...",
    },
    // ... more retailers
  ]}
  isWatched={false}
  onWatchToggle={(id) => handleWatch(id)}
  onCompareClick={(id) => openPanel(id)}
/>
```
