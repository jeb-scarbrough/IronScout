export const SELECTORS = {
  // Brownells product pages expose canonical pricing/availability in JSON-LD Product.offers.
  jsonLd: 'script[type="application/ld+json"]',
  // Fallback title selector if JSON-LD is missing name.
  title: 'h1.pdp-info__title, h1',
  // Price is extracted from JSON-LD only for deterministic variant handling.
  price: '',
  // Availability fallbacks if schema availability is missing.
  inStock: '[data-product-isinstock="true"], .in-stock',
  outOfStock: '[data-product-isoutofstock="true"], .out-of-stock',
  backorder: '[data-product-isbackorder="true"], .backorder',
  sku: '',
  productId: '',
  upc: '',
  image: '',
} as const
