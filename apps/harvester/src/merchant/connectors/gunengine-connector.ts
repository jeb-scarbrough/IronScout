/**
 * GunEngine Feed Connector
 *
 * Handles GunEngine Offer Feed V2 format.
 * Reference: GunEngine Offer Feed V2 specification
 *
 * GunEngine uses a more structured format with specific field names
 * and expects XML or JSON format.
 *
 * Required fields:
 * - item_id: Unique product identifier (SKU)
 * - upc: Universal Product Code
 * - title: Product name
 * - price: Current price
 * - url: Product URL
 * - stock_status: Availability (in_stock, out_of_stock, limited)
 *
 * Product attributes:
 * - manufacturer: Brand name
 * - caliber: Ammunition caliber
 * - bullet_weight: Weight in grains
 * - bullet_type: Projectile type
 * - case_material: Brass, Steel, etc.
 * - rounds_per_box: Count per package
 *
 * Extended fields:
 * - msrp: Manufacturer suggested retail price
 * - map_price: Minimum advertised price
 * - shipping_cost: Flat shipping rate
 * - handling_time: Days to ship
 */

import type { FeedFormatType } from '@ironscout/db'
import {
  BaseConnector,
  extractString,
  extractNumber,
  extractBoolean,
  validateUPC,
  detectContentFormat,
} from './base-connector'
import type { ParsedFeedRecord, FieldError, FieldCoercion } from './types'
import { ERROR_CODES } from './types'

// ============================================================================
// GUNENGINE FIELD MAPPINGS
// ============================================================================

const GUNENGINE_FIELDS = {
  // Identity
  itemId: ['item_id', 'itemId', 'sku', 'id'],
  upc: ['upc', 'gtin', 'ean', 'barcode'],

  // Core product info
  title: ['title', 'name', 'product_title', 'product_name'],
  description: ['description', 'long_description', 'details'],
  price: ['price', 'current_price', 'sale_price'],
  msrp: ['msrp', 'list_price', 'retail_price'],
  url: ['url', 'link', 'product_url', 'product_link'],

  // Stock
  stockStatus: ['stock_status', 'availability', 'in_stock'],
  stockQuantity: ['stock_quantity', 'qty', 'inventory_count'],

  // Brand/Category
  manufacturer: ['manufacturer', 'brand', 'vendor'],
  category: ['category', 'product_type', 'item_category'],

  // Ammo-specific attributes (GunEngine V2)
  caliber: ['caliber', 'ammunition_caliber', 'cartridge'],
  bulletWeight: ['bullet_weight', 'grain', 'grain_weight'],
  bulletType: ['bullet_type', 'projectile_type', 'ammo_type'],
  caseMaterial: ['case_material', 'casing', 'case_type'],
  roundsPerBox: ['rounds_per_box', 'round_count', 'quantity'],

  // Media
  imageUrl: ['image_url', 'image_link', 'main_image', 'image'],

  // Shipping
  shippingCost: ['shipping_cost', 'shipping', 'flat_rate_shipping'],
  handlingTime: ['handling_time', 'lead_time', 'ships_in'],
}

// ============================================================================
// GUNENGINE CONNECTOR
// ============================================================================

export class GunEngineConnector extends BaseConnector {
  readonly formatType: FeedFormatType = 'GUNENGINE_V2'
  readonly name = 'GunEngine Offer Feed V2'

  canHandle(content: string): boolean {
    try {
      const format = detectContentFormat(content)

      // GunEngine typically uses XML or JSON
      if (format !== 'json' && format !== 'xml') {
        return false
      }

      const contentLower = content.toLowerCase()

      // Check for GunEngine-specific field patterns
      const hasItemId = contentLower.includes('item_id') || contentLower.includes('itemid')
      const hasManufacturer = contentLower.includes('manufacturer')
      const hasStockStatus = contentLower.includes('stock_status') || contentLower.includes('stockstatus')

      // Look for GunEngine V2 specific markers
      const hasV2Markers =
        contentLower.includes('bullet_weight') ||
        contentLower.includes('bulletweight') ||
        contentLower.includes('rounds_per_box') ||
        contentLower.includes('roundsperbox')

      return hasItemId && hasManufacturer && (hasStockStatus || hasV2Markers)
    } catch {
      return false
    }
  }

  getFieldMapping(): Record<string, string> {
    return {
      item_id: 'item_id | itemId | sku | id (required)',
      upc: 'upc | gtin | ean | barcode (required)',
      title: 'title | name | product_title (required)',
      price: 'price | current_price | sale_price (required)',
      url: 'url | link | product_url (required)',
      stock_status: 'stock_status | availability | in_stock (required)',
      manufacturer: 'manufacturer | brand | vendor',
      caliber: 'caliber | ammunition_caliber | cartridge',
      bullet_weight: 'bullet_weight | grain | grain_weight',
      bullet_type: 'bullet_type | projectile_type | ammo_type',
      case_material: 'case_material | casing | case_type',
      rounds_per_box: 'rounds_per_box | round_count | quantity',
      image_url: 'image_url | image_link | main_image',
      msrp: 'msrp | list_price | retail_price',
      shipping_cost: 'shipping_cost | shipping | flat_rate_shipping',
    }
  }

  protected mapRow(
    row: Record<string, unknown>,
    index: number
  ): { record: ParsedFeedRecord; errors: FieldError[]; coercions: FieldCoercion[] } {
    const errors: FieldError[] = []
    const coercions: FieldCoercion[] = []

    // Extract UPC (required for indexing)
    const rawUpc = extractString(row, GUNENGINE_FIELDS.upc, coercions, 'upc')
    const validatedUpc = validateUPC(rawUpc)

    if (rawUpc && !validatedUpc) {
      errors.push({
        field: 'upc',
        code: ERROR_CODES.INVALID_UPC,
        message: `Invalid UPC format: ${rawUpc}`,
        rawValue: rawUpc,
      })
    }

    // Extract SKU (GunEngine uses item_id as primary identifier)
    const sku = extractString(row, GUNENGINE_FIELDS.itemId, coercions, 'sku')

    // Extract title (required)
    const title = extractString(row, GUNENGINE_FIELDS.title, coercions, 'title') || ''

    // Extract price
    const price = extractNumber(row, GUNENGINE_FIELDS.price, coercions, 'price') || 0

    // Extract stock status - GunEngine uses specific values
    const stockStatusRaw = extractString(row, GUNENGINE_FIELDS.stockStatus, coercions, 'stockStatus')
    let inStock = true
    if (stockStatusRaw) {
      const status = stockStatusRaw.toLowerCase()
      inStock = status === 'in_stock' || status === 'instock' || status === 'available' || status === 'limited'

      if (status !== String(inStock)) {
        coercions.push({
          field: 'inStock',
          rawValue: stockStatusRaw,
          coercedValue: inStock,
          coercionType: 'boolean',
        })
      }
    }

    const record: ParsedFeedRecord = {
      upc: validatedUpc || undefined,
      sku,
      title,
      description: extractString(row, GUNENGINE_FIELDS.description, coercions, 'description'),
      brand: extractString(row, GUNENGINE_FIELDS.manufacturer, coercions, 'brand'),
      price,
      caliber: extractString(row, GUNENGINE_FIELDS.caliber, coercions, 'caliber'),
      grainWeight: extractNumber(row, GUNENGINE_FIELDS.bulletWeight, coercions, 'grainWeight'),
      caseType: extractString(row, GUNENGINE_FIELDS.caseMaterial, coercions, 'caseType'),
      bulletType: extractString(row, GUNENGINE_FIELDS.bulletType, coercions, 'bulletType'),
      roundCount: extractNumber(row, GUNENGINE_FIELDS.roundsPerBox, coercions, 'roundCount'),
      inStock,
      quantity: extractNumber(row, GUNENGINE_FIELDS.stockQuantity, coercions, 'quantity'),
      productUrl: extractString(row, GUNENGINE_FIELDS.url, coercions, 'productUrl'),
      imageUrl: extractString(row, GUNENGINE_FIELDS.imageUrl, coercions, 'imageUrl'),
      rawRow: row,
      rowIndex: index,
    }

    // GunEngine-specific validation
    if (!sku) {
      errors.push({
        field: 'item_id',
        code: ERROR_CODES.MISSING_TITLE, // Reusing code for missing required field
        message: 'Missing item_id - required for GunEngine feeds',
      })
    }

    if (!record.productUrl) {
      errors.push({
        field: 'url',
        code: ERROR_CODES.MISSING_TITLE, // Reusing code for missing required field
        message: 'Missing url - required for GunEngine feeds',
      })
    }

    return { record, errors, coercions }
  }
}
