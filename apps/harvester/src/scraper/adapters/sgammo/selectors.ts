/**
 * SGAmmo CSS Selectors
 *
 * SGAmmo runs on WooCommerce with standard product page structure.
 * Primary extraction uses JSON-LD schema data for reliability.
 * DOM selectors serve as fallback.
 */

export const SELECTORS = {
  // JSON-LD schema (preferred - most reliable)
  jsonLd: 'script[type="application/ld+json"]',

  // Product title
  title: 'h1.product_title',

  // Price (WooCommerce standard)
  price: '.woocommerce-Price-amount.amount',

  // Stock status
  inStock: '.stock.in-stock',
  outOfStock: '.stock.out-of-stock',

  // SKU
  sku: '.sku',

  // Product image
  image: 'img.wp-post-image',

  // Product gallery (backup for image)
  gallery: '.woocommerce-product-gallery__image img',

  // Add to cart form (contains product ID)
  addToCartForm: 'form.cart',

  // Quantity tiers (bulk pricing)
  quantityTiers: '.quantity-tiers, .bulk-pricing',
} as const

/**
 * JSON-LD schema.org availability values
 */
export const SCHEMA_AVAILABILITY = {
  inStock: 'https://schema.org/InStock',
  outOfStock: 'https://schema.org/OutOfStock',
  preOrder: 'https://schema.org/PreOrder',
  backOrder: 'https://schema.org/BackOrder',
} as const
