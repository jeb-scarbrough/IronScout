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
  title: 'h1.sgammo-content-single-product__title, h1.product_title, h1.entry-title',

  // Price (SGAmmo custom layout + WooCommerce fallback)
  price: '.sgammo-content-single-product__details__right__price .woocommerce-Price-amount.amount, .woocommerce-Price-amount.amount',

  // Stock status
  inStock: '.stock.in-stock',
  outOfStock: '.stock.out-of-stock',

  // SKU
  sku: '.sgammo-content-single-product__details__right__sku, .sku',

  // Product image
  image: '.sgammo-content-single-product__details__left__main-img img, .woocommerce-product-gallery__image img, img.wp-post-image',

  // Product gallery (backup for image)
  gallery: '.sgammo-content-single-product__details__left__thumbnails img, .woocommerce-product-gallery__image img',

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
