/**
 * Generic Feed Connector
 *
 * Handles auto-detection of common CSV/JSON/XML formats with flexible field mapping.
 * Falls back to this connector when no specific format is detected.
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

// ============================================================================
// FIELD MAPPINGS FOR COMMON VARIATIONS
// ============================================================================

const TITLE_FIELDS = [
  'title', 'name', 'product_name', 'productName', 'product_title', 'productTitle',
  'item_name', 'itemName', 'description', 'product',
]

const PRICE_FIELDS = [
  'price', 'sale_price', 'salePrice', 'current_price', 'currentPrice',
  'retail_price', 'retailPrice', 'unit_price', 'unitPrice', 'cost',
]

const UPC_FIELDS = [
  'upc', 'UPC', 'gtin', 'GTIN', 'ean', 'EAN', 'barcode', 'product_id', 'productId',
  'universal_product_code', 'upc_code', 'upcCode',
]

const SKU_FIELDS = [
  'sku', 'SKU', 'item_sku', 'itemSku', 'product_sku', 'productSku',
  'item_id', 'itemId', 'model', 'part_number', 'partNumber', 'mpn',
]

const DESCRIPTION_FIELDS = [
  'description', 'desc', 'product_description', 'productDescription',
  'long_description', 'longDescription', 'details', 'summary',
]

const BRAND_FIELDS = [
  'brand', 'manufacturer', 'mfg', 'make', 'vendor', 'brand_name', 'brandName',
  'manufacturer_name', 'manufacturerName',
]

const CALIBER_FIELDS = [
  'caliber', 'calibre', 'gauge', 'cartridge', 'ammunition_type', 'ammo_type',
  'ammoType', 'bullet_caliber', 'bulletCaliber',
]

const GRAIN_FIELDS = [
  'grain', 'grain_weight', 'grainWeight', 'bullet_weight', 'bulletWeight',
  'weight', 'grains',
]

const CASE_FIELDS = [
  'case_type', 'caseType', 'case_material', 'caseMaterial', 'casing',
  'case', 'shell_type', 'shellType',
]

const BULLET_TYPE_FIELDS = [
  'bullet_type', 'bulletType', 'projectile', 'projectile_type', 'projectileType',
  'ammo_style', 'ammoStyle', 'round_type', 'roundType',
]

const ROUND_COUNT_FIELDS = [
  'round_count', 'roundCount', 'rounds', 'pack_size', 'packSize', 'quantity',
  'count', 'box_count', 'boxCount', 'num_rounds', 'numRounds',
]

const STOCK_FIELDS = [
  'in_stock', 'inStock', 'availability', 'stock_status', 'stockStatus',
  'available', 'is_available', 'isAvailable', 'stock',
]

const QUANTITY_FIELDS = [
  'stock_quantity', 'stockQuantity', 'qty', 'inventory', 'inventory_count',
  'inventoryCount', 'available_qty', 'availableQty',
]

const URL_FIELDS = [
  'url', 'link', 'product_url', 'productUrl', 'product_link', 'productLink',
  'page_url', 'pageUrl', 'buy_link', 'buyLink',
]

const IMAGE_FIELDS = [
  'image_url', 'imageUrl', 'image', 'image_link', 'imageLink', 'photo',
  'picture', 'thumbnail', 'main_image', 'mainImage', 'product_image', 'productImage',
]

// ============================================================================
// GENERIC CONNECTOR
// ============================================================================

export class GenericConnector extends BaseConnector {
  readonly formatType: FeedFormatType = 'GENERIC'
  readonly name = 'Auto-Detect Generic Format'

  canHandle(content: string): boolean {
    // Generic connector can always attempt to handle content
    try {
      const format = detectContentFormat(content)
      return format === 'csv' || format === 'json' || format === 'xml'
    } catch {
      return false
    }
  }

  getFieldMapping(): Record<string, string> {
    return {
      title: TITLE_FIELDS.join(' | '),
      price: PRICE_FIELDS.join(' | '),
      upc: UPC_FIELDS.join(' | '),
      sku: SKU_FIELDS.join(' | '),
      description: DESCRIPTION_FIELDS.join(' | '),
      brand: BRAND_FIELDS.join(' | '),
      caliber: CALIBER_FIELDS.join(' | '),
      grain: GRAIN_FIELDS.join(' | '),
      caseType: CASE_FIELDS.join(' | '),
      bulletType: BULLET_TYPE_FIELDS.join(' | '),
      roundCount: ROUND_COUNT_FIELDS.join(' | '),
      inStock: STOCK_FIELDS.join(' | '),
      quantity: QUANTITY_FIELDS.join(' | '),
      productUrl: URL_FIELDS.join(' | '),
      imageUrl: IMAGE_FIELDS.join(' | '),
    }
  }

  protected mapRow(
    row: Record<string, unknown>,
    index: number
  ): { record: ParsedFeedRecord; errors: FieldError[]; coercions: FieldCoercion[] } {
    const errors: FieldError[] = []
    const coercions: FieldCoercion[] = []

    // Extract values with coercion tracking
    const rawUpc = extractString(row, UPC_FIELDS, coercions, 'upc')
    const upc = validateUPC(rawUpc) || undefined

    const record: ParsedFeedRecord = {
      upc,
      sku: extractString(row, SKU_FIELDS, coercions, 'sku'),
      title: extractString(row, TITLE_FIELDS, coercions, 'title') || '',
      description: extractString(row, DESCRIPTION_FIELDS, coercions, 'description'),
      brand: extractString(row, BRAND_FIELDS, coercions, 'brand'),
      price: extractNumber(row, PRICE_FIELDS, coercions, 'price') || 0,
      caliber: extractString(row, CALIBER_FIELDS, coercions, 'caliber'),
      grainWeight: extractNumber(row, GRAIN_FIELDS, coercions, 'grainWeight'),
      caseType: extractString(row, CASE_FIELDS, coercions, 'caseType'),
      bulletType: extractString(row, BULLET_TYPE_FIELDS, coercions, 'bulletType'),
      roundCount: extractNumber(row, ROUND_COUNT_FIELDS, coercions, 'roundCount'),
      inStock: extractBoolean(row, STOCK_FIELDS, coercions, 'inStock', true),
      quantity: extractNumber(row, QUANTITY_FIELDS, coercions, 'quantity'),
      productUrl: extractString(row, URL_FIELDS, coercions, 'productUrl'),
      imageUrl: extractString(row, IMAGE_FIELDS, coercions, 'imageUrl'),
      rawRow: row,
      rowIndex: index,
    }

    return { record, errors, coercions }
  }
}
