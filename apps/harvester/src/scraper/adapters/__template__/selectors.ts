/**
 * Selector Template
 *
 * Replace all selectors with retailer-specific CSS selectors.
 * Keep selectors tight and deterministic.
 */

export const SELECTORS = {
  jsonLd: 'script[type="application/ld+json"]', // JSON-LD schema (preferred when available)
  title: '', // e.g., 'h1.product-title'
  price: '', // e.g., '.price .amount'
  inStock: '', // e.g., '.stock.in-stock'
  outOfStock: '', // e.g., '.stock.out-of-stock'
  backorder: '', // e.g., '.stock.backorder'
  sku: '', // e.g., '[data-sku]'
  productId: '', // e.g., '[data-product-id]'
  upc: '', // e.g., '.product-upc'
  image: '', // e.g., '.product-image img'
} as const
