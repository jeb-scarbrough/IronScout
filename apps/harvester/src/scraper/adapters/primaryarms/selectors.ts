/**
 * Primary Arms API field mappings and attribute labels.
 *
 * Primary Arms exposes product data via a NetSuite JSON endpoint (/api/items).
 * These constants document the fields the adapter relies on.
 */

export const PRIMARY_ARMS_FIELDS = {
  items: 'items',
  title: 'pagetitle',
  urlComponent: 'urlcomponent',
  price: 'onlinecustomerprice',
  priceDetail: 'onlinecustomerprice_detail.onlinecustomerprice',
  inStock: 'isinstock',
  backorderable: 'isbackorderable',
  purchasable: 'ispurchasable',
  sku: 'itemid',
  productId: 'internalid',
  upc: 'upccode',
  brand: 'custitem_brand',
  manufacturer: 'manufacturer',
  imageUrl: 'itemimages_detail.urls[0].url',
  attributes: 'custitem_test_for_website',
} as const

export const ATTRIBUTE_LABELS = {
  caliber: ['caliber gauge', 'caliber'],
  bulletWeight: ['bullet weight', 'projectile weight', 'bullet wt'],
  caseMaterial: ['case', 'case material'],
  bulletType: ['bullet type', 'projectile type'],
  brand: ['brand'],
  loadType: ['shot size', 'shot size/slug', 'shot size or slug'],
  shellLength: ['shell length', 'shell length (in)'],
} as const
