/**
 * AmmoSeek Feed Connector
 *
 * Handles the AmmoSeek-compatible feed format used by many dealers.
 * Spec reference: https://ammoseek.com/feed-specifications
 *
 * Required fields:
 * - upc: Universal Product Code
 * - title: Product name
 * - price: Current price
 * - link: Product URL
 * - in_stock: Availability (true/false/1/0)
 *
 * Optional fields:
 * - brand: Manufacturer name
 * - caliber: Ammunition caliber
 * - grain: Bullet weight in grains
 * - case_type: Brass, Steel, Aluminum, etc.
 * - bullet_type: FMJ, JHP, SP, etc.
 * - rounds: Number of rounds per box
 * - image_link: Product image URL
 * - description: Product description
 * - sale_price: Discounted price (if different from price)
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
// AMMOSEEK FIELD MAPPINGS
// ============================================================================

// AmmoSeek has specific expected field names
const AMMOSEEK_FIELDS = {
  // Required
  upc: ['upc', 'UPC'],
  title: ['title', 'name', 'product_name'],
  price: ['price'],
  link: ['link', 'url', 'product_url'],
  inStock: ['in_stock', 'instock', 'availability'],

  // Optional
  brand: ['brand', 'manufacturer'],
  caliber: ['caliber', 'calibre', 'gauge'],
  grain: ['grain', 'grain_weight', 'grains'],
  caseType: ['case_type', 'casing', 'case_material'],
  bulletType: ['bullet_type', 'projectile'],
  rounds: ['rounds', 'round_count', 'quantity', 'count'],
  imageLink: ['image_link', 'image_url', 'image'],
  description: ['description', 'desc'],
  salePrice: ['sale_price', 'saleprice'],
  sku: ['sku', 'item_id', 'product_id'],
}

// ============================================================================
// AMMOSEEK CONNECTOR
// ============================================================================

export class AmmoSeekConnector extends BaseConnector {
  readonly formatType: FeedFormatType = 'AMMOSEEK_V1'
  readonly name = 'AmmoSeek Compatible Format'

  canHandle(content: string): boolean {
    try {
      const format = detectContentFormat(content)
      if (format !== 'csv' && format !== 'json' && format !== 'xml') {
        return false
      }

      // Check for AmmoSeek-specific field names in first few lines
      const contentLower = content.toLowerCase()

      // Must have these AmmoSeek-specific columns
      const hasUpc = contentLower.includes('upc')
      const hasTitle = contentLower.includes('title') || contentLower.includes('product_name')
      const hasPrice = contentLower.includes('price')
      const hasLink = contentLower.includes('link') || contentLower.includes('url')

      return hasUpc && hasTitle && hasPrice && hasLink
    } catch {
      return false
    }
  }

  getFieldMapping(): Record<string, string> {
    return {
      upc: 'upc (required)',
      title: 'title | name | product_name (required)',
      price: 'price (required)',
      link: 'link | url | product_url (required)',
      in_stock: 'in_stock | instock | availability (required)',
      brand: 'brand | manufacturer',
      caliber: 'caliber | calibre | gauge',
      grain: 'grain | grain_weight | grains',
      case_type: 'case_type | casing | case_material',
      bullet_type: 'bullet_type | projectile',
      rounds: 'rounds | round_count | quantity | count',
      image_link: 'image_link | image_url | image',
      description: 'description | desc',
      sale_price: 'sale_price | saleprice',
      sku: 'sku | item_id | product_id',
    }
  }

  protected mapRow(
    row: Record<string, unknown>,
    index: number
  ): { record: ParsedFeedRecord; errors: FieldError[]; coercions: FieldCoercion[] } {
    const errors: FieldError[] = []
    const coercions: FieldCoercion[] = []

    // Extract UPC (required for indexing)
    const rawUpc = extractString(row, AMMOSEEK_FIELDS.upc, coercions, 'upc')
    const validatedUpc = validateUPC(rawUpc)

    if (rawUpc && !validatedUpc) {
      errors.push({
        field: 'upc',
        code: ERROR_CODES.INVALID_UPC,
        message: `Invalid UPC format: ${rawUpc}`,
        rawValue: rawUpc,
      })
    }

    // Extract title (required)
    const title = extractString(row, AMMOSEEK_FIELDS.title, coercions, 'title') || ''

    // Extract price (required)
    const salePrice = extractNumber(row, AMMOSEEK_FIELDS.salePrice, coercions, 'salePrice')
    const regularPrice = extractNumber(row, AMMOSEEK_FIELDS.price, coercions, 'price') || 0
    const price = salePrice && salePrice > 0 ? salePrice : regularPrice

    // Extract other fields
    const record: ParsedFeedRecord = {
      upc: validatedUpc || undefined,
      sku: extractString(row, AMMOSEEK_FIELDS.sku, coercions, 'sku'),
      title,
      description: extractString(row, AMMOSEEK_FIELDS.description, coercions, 'description'),
      brand: extractString(row, AMMOSEEK_FIELDS.brand, coercions, 'brand'),
      price,
      salePrice: salePrice || undefined,
      caliber: extractString(row, AMMOSEEK_FIELDS.caliber, coercions, 'caliber'),
      grainWeight: extractNumber(row, AMMOSEEK_FIELDS.grain, coercions, 'grainWeight'),
      caseType: extractString(row, AMMOSEEK_FIELDS.caseType, coercions, 'caseType'),
      bulletType: extractString(row, AMMOSEEK_FIELDS.bulletType, coercions, 'bulletType'),
      roundCount: extractNumber(row, AMMOSEEK_FIELDS.rounds, coercions, 'roundCount'),
      inStock: extractBoolean(row, AMMOSEEK_FIELDS.inStock, coercions, 'inStock', true),
      productUrl: extractString(row, AMMOSEEK_FIELDS.link, coercions, 'productUrl'),
      imageUrl: extractString(row, AMMOSEEK_FIELDS.imageLink, coercions, 'imageUrl'),
      rawRow: row,
      rowIndex: index,
    }

    // AmmoSeek-specific validation: warn if missing recommended fields
    if (!record.caliber) {
      errors.push({
        field: 'caliber',
        code: ERROR_CODES.MISSING_CALIBER,
        message: 'Missing caliber - recommended for ammunition listings',
      })
    }

    if (!record.brand) {
      errors.push({
        field: 'brand',
        code: ERROR_CODES.MISSING_BRAND,
        message: 'Missing brand - recommended for ammunition listings',
      })
    }

    return { record, errors, coercions }
  }
}
