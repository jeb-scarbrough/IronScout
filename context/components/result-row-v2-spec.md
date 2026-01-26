# ResultRow v2 Component Specification

**Status:** Draft
**Component:** `apps/web/components/results/result-row-v2.tsx`
**Replaces:** `result-row.tsx`
**Parent Spec:** `search-results-ux-spec.md`

---

## Purpose

Dense table row for power users in execution mode. Shows product summary with retailer count, enabling quick scanning and comparison via panel.

Design goal: "I know what I want. Show me the data. Let me sort."

---

## Props Interface

```typescript
interface ResultRowV2Props {
  // Product identity
  id: string
  productTitle: string

  // Attributes
  caliber: string
  bulletType?: string
  grainWeight?: number
  roundCount?: number

  // Pricing summary (computed from retailers)
  lowestPricePerRound: number
  retailerCount: number
  anyInStock: boolean

  // User state
  isWatched: boolean
  onWatchToggle: (productId: string) => void

  // Panel trigger
  onCompareClick: (productId: string) => void
}
```

---

## Column Layout

| Column | Header | Width | Align | Content |
|--------|--------|-------|-------|---------|
| Product | "Product" | 30% | left | Title + attributes |
| Caliber | "Cal" | 8% | left | Badge |
| $/rd | "$/rd" | 10% | right | Price, sortable |
| Retailers | "Retailers" | 15% | left | Count + link |
| Stock | "Stock" | 10% | center | Badge, sortable |
| Watch | "★" | 7% | center | Icon button |
| Action | "Action" | 12% | center | CTA button |

---

## Column Details

### Product Column

```
┌────────────────────────────────────┐
│ Federal American Eagle 9mm 115gr...│
└────────────────────────────────────┘
```

- Max 50 characters, truncate with ellipsis
- Tooltip shows full title on hover
- No link (row action handles navigation)

### Caliber Column

```
┌──────┐
│ 9mm  │
└──────┘
```

- Badge style: `bg-muted/50 text-foreground border`
- Compact: no padding waste

### $/rd Column

```
┌──────────┐
│ $0.30/rd │
└──────────┘
```

| Element | Style |
|---------|-------|
| Price | `font-mono font-bold text-lg` |
| "/rd" suffix | `text-xs text-muted-foreground` |

**Sorting:**
- Header is clickable
- Cycles: ascending → descending → clear
- Uses URL params (`sortBy=price_asc`, `sortBy=price_desc`)

**Note:** This is the **lowest in-stock price** across all retailers. If all OOS, show lowest OOS price with muted style.

### Retailers Column

| Count | Display | Behavior |
|-------|---------|----------|
| 1 | "1 retailer" | No link, click goes to View |
| 2-3 | "{N} retailers" | Link, opens panel |
| 4+ | "{N} retailers" | Link, opens panel |

Style when clickable: `text-primary underline-offset-4 hover:underline cursor-pointer`

### Stock Column

```
┌──────────┐
│ In Stock │
└──────────┘
```

| State | Badge Style |
|-------|-------------|
| Any in stock | `border-emerald-500 text-emerald-600` |
| All out of stock | `border-red-400 text-red-500` |

**Sorting:**
- Header is clickable (client-side sort)
- "In Stock" rows first, then "Out" rows
- Within each group, maintain price sort

### Watch Column

| State | Icon |
|-------|------|
| Not watched | `Bookmark` outline, muted |
| Watched | `Bookmark` filled, primary |

Click triggers `onWatchToggle(id)`.

### Action Column

| Condition | Button Text | Behavior |
|-----------|-------------|----------|
| 1 retailer | "View" | Opens retailer URL |
| 2+ retailers | "Compare" | Opens panel via `onCompareClick` |

Button: `size="sm" variant="outline" className="h-8 text-xs"`

---

## Row States

### Hover

```css
tr:hover {
  background-color: hsl(var(--muted) / 0.5);
}
```

### All Out of Stock

- Entire row has `opacity-60`
- Stock badge shows "Out"
- Still functional (user may want to watch)

### Loading (Skeleton)

```tsx
<ResultRowV2Skeleton />
```

Each column gets a placeholder bar matching expected content width.

---

## Table Header Component

```typescript
interface ResultTableHeaderV2Props {
  currentSort: 'relevance' | 'price_asc' | 'price_desc'
  stockFilter: 'all' | 'in_stock'
  onSortChange: (sort: string) => void
  onStockFilterChange: (filter: 'all' | 'in_stock') => void
}
```

**Sortable Headers:**
- $/rd: Cycles through price sorts (URL-based)
- Stock: Client-side toggle (in-stock first)

**Sort Indicator:**
```
┌────────────────┐
│ $/rd  ▲        │  ← ascending active
│ $/rd  ▼        │  ← descending active
│ $/rd  ↕        │  ← no sort (both muted)
└────────────────┘
```

---

## Mobile Behavior

Grid view on mobile **falls back to cards**.

```tsx
// In parent component
if (viewport < 768) {
  return <ResultCardV2 {...cardProps} />
}
return <ResultRowV2 {...rowProps} />
```

Do not render a table on mobile. Tables are unusable on small screens.

---

## Removed (vs v1)

| Element | Reason |
|---------|--------|
| `retailerName` display | Single retailer doesn't scale; use count + panel |
| `retailerUrl` direct link | CTA now opens panel for comparison |
| `totalPrice` column | Clutters grid; available in panel |
| Per-row retailer CTA | Replaced with "Compare" pattern |
| `placement` prop | Not needed for analytics in v2 |

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Sortable headers | `role="columnheader" aria-sort="ascending|descending|none"` |
| Watch button | `aria-label="Add to watchlist"` / `"Remove from watchlist"` |
| Retailers link | Standard anchor or button semantics |
| Row hover | Visible focus state on tab navigation |

---

## Example Usage

```tsx
<table>
  <ResultTableHeaderV2
    currentSort="price_asc"
    stockFilter="all"
    onSortChange={(sort) => updateUrl(sort)}
    onStockFilterChange={(filter) => setFilter(filter)}
  />
  <tbody>
    {products.map((product) => (
      <ResultRowV2
        key={product.id}
        id={product.id}
        productTitle={product.name}
        caliber={product.caliber}
        bulletType={product.bulletType}
        grainWeight={product.grainWeight}
        roundCount={product.roundCount}
        lowestPricePerRound={product.lowestPrice}
        retailerCount={product.retailers.length}
        anyInStock={product.retailers.some(r => r.inStock)}
        isWatched={watchedIds.has(product.id)}
        onWatchToggle={handleWatch}
        onCompareClick={openPanel}
      />
    ))}
  </tbody>
</table>
```
