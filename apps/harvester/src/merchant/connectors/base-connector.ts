/**
 * Base Feed Connector
 *
 * Provides common parsing utilities and validation logic
 * shared across all format-specific connectors.
 */

import { parse as csvParse } from 'csv-parse/sync'
import { XMLParser } from 'fast-xml-parser'
import type { FeedFormatType } from '@ironscout/db'
import {
  ERROR_CODES,
  type FeedConnector,
  type FeedParseResult,
  type ParsedFeedRecord,
  type ParsedRecordResult,
  type FieldError,
  type FieldCoercion,
} from './types'
import { normalizeUpc } from '@ironscout/upc'

// ============================================================================
// CONTENT DETECTION
// ============================================================================

export type ContentFormat = 'csv' | 'json' | 'xml'

export function detectContentFormat(content: string): ContentFormat {
  const trimmed = content.trim()

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }

  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return 'xml'
  }

  return 'csv'
}

// ============================================================================
// CONTENT PARSING
// ============================================================================

export function parseCSV(content: string): Record<string, unknown>[] {
  return csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  })
}

export function parseJSON(content: string): Record<string, unknown>[] {
  const data = JSON.parse(content)

  if (Array.isArray(data)) {
    return data
  }

  // Handle wrapped arrays
  if (data.products && Array.isArray(data.products)) {
    return data.products
  }
  if (data.items && Array.isArray(data.items)) {
    return data.items
  }
  if (data.data && Array.isArray(data.data)) {
    return data.data
  }
  if (data.offers && Array.isArray(data.offers)) {
    return data.offers
  }

  return [data]
}

export function parseXML(content: string): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '_text',
  })

  const result = parser.parse(content)

  // Try common XML structures
  const items =
    result.products?.product ||
    result.feed?.products?.product ||
    result.feed?.entry ||
    result.rss?.channel?.item ||
    result.items?.item ||
    result.catalog?.product ||
    result.offers?.offer ||
    []

  return Array.isArray(items) ? items : [items]
}

export function parseContent(content: string): Record<string, unknown>[] {
  const format = detectContentFormat(content)

  switch (format) {
    case 'csv':
      return parseCSV(content)
    case 'json':
      return parseJSON(content)
    case 'xml':
      return parseXML(content)
    default:
      throw new Error(`Unsupported content format: ${format}`)
  }
}

// ============================================================================
// VALUE EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract a string value from a row, trying multiple field names
 */
export function extractString(
  row: Record<string, unknown>,
  fields: string[],
  coercions: FieldCoercion[],
  targetField: string
): string | undefined {
  for (const field of fields) {
    const value = row[field]
    if (value !== undefined && value !== null && value !== '') {
      const stringVal = String(value).trim()
      if (stringVal !== String(value)) {
        coercions.push({
          field: targetField,
          rawValue: value,
          coercedValue: stringVal,
          coercionType: 'trim',
        })
      }
      return stringVal || undefined
    }
  }
  return undefined
}

/**
 * Extract a numeric value from a row, trying multiple field names
 */
export function extractNumber(
  row: Record<string, unknown>,
  fields: string[],
  coercions: FieldCoercion[],
  targetField: string
): number | undefined {
  for (const field of fields) {
    const value = row[field]
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'number') {
        return value
      }
      // Clean and parse string
      const cleaned = String(value).replace(/[^0-9.-]/g, '')
      const parsed = parseFloat(cleaned)
      if (!isNaN(parsed)) {
        coercions.push({
          field: targetField,
          rawValue: value,
          coercedValue: parsed,
          coercionType: 'numeric',
        })
        return parsed
      }
    }
  }
  return undefined
}

/**
 * Extract a boolean value from a row
 */
export function extractBoolean(
  row: Record<string, unknown>,
  fields: string[],
  coercions: FieldCoercion[],
  targetField: string,
  defaultValue: boolean = true
): boolean {
  for (const field of fields) {
    const value = row[field]
    if (value !== undefined && value !== null) {
      if (typeof value === 'boolean') {
        return value
      }
      const strVal = String(value).toLowerCase().trim()
      const boolResult =
        strVal === 'true' ||
        strVal === '1' ||
        strVal === 'yes' ||
        strVal === 'in stock' ||
        strVal === 'available' ||
        strVal === 'y'

      coercions.push({
        field: targetField,
        rawValue: value,
        coercedValue: boolResult,
        coercionType: 'boolean',
      })
      return boolResult
    }
  }
  return defaultValue
}

/**
 * Validate and normalize UPC
 * Returns null if invalid, normalized UPC string if valid.
 * Strips connector-specific prefixes (UPC:, GTIN:) before shared validation.
 * Rejects 9/10/11-digit codes (previously accepted in range 8-14).
 */
export function validateUPC(upc: string | undefined): string | null {
  if (!upc) return null
  // Strip common prefixes before shared normalization
  const cleaned = upc.replace(/^(UPC:|GTIN:)/i, '').trim()
  return normalizeUpc(cleaned)
}

// ============================================================================
// BASE CONNECTOR CLASS
// ============================================================================

export abstract class BaseConnector implements FeedConnector {
  abstract readonly formatType: FeedFormatType
  abstract readonly name: string

  abstract canHandle(content: string): boolean
  abstract getFieldMapping(): Record<string, string>

  /**
   * Map a raw row to a ParsedFeedRecord
   * Override in subclass for format-specific mapping
   */
  protected abstract mapRow(
    row: Record<string, unknown>,
    index: number
  ): { record: ParsedFeedRecord; errors: FieldError[]; coercions: FieldCoercion[] }

  async parse(content: string): Promise<FeedParseResult> {
    const startTime = Date.now()
    const rows = parseContent(content)

    const parsedRecords: ParsedRecordResult[] = []
    const errorCodes: Record<string, number> = {}

    let indexableCount = 0
    let quarantineCount = 0
    let rejectCount = 0

    for (let i = 0; i < rows.length; i++) {
      try {
        const { record, errors, coercions } = this.mapRow(rows[i], i)

        // Determine indexability
        const hasValidUPC = !!record.upc
        const hasRequiredFields = !!record.title && record.price > 0

        let isIndexable = hasValidUPC && hasRequiredFields

        // Add UPC error if missing
        if (!hasValidUPC) {
          errors.push({
            field: 'upc',
            code: ERROR_CODES.MISSING_UPC,
            message: 'Missing or invalid UPC - record will be quarantined',
            rawValue: record.rawRow['upc'] || record.rawRow['UPC'],
          })
        }

        // Add required field errors
        if (!record.title) {
          errors.push({
            field: 'title',
            code: ERROR_CODES.MISSING_TITLE,
            message: 'Missing product title',
          })
        }
        if (!record.price || record.price <= 0) {
          errors.push({
            field: 'price',
            code: ERROR_CODES.INVALID_PRICE,
            message: 'Missing or invalid price',
            rawValue: record.rawRow['price'] || record.rawRow['Price'],
          })
        }

        // Count error codes
        for (const error of errors) {
          errorCodes[error.code] = (errorCodes[error.code] || 0) + 1
        }

        // Categorize record
        if (isIndexable) {
          indexableCount++
        } else if (hasRequiredFields && !hasValidUPC) {
          // Has data but missing UPC -> quarantine
          quarantineCount++
        } else {
          // Missing required fields -> reject
          rejectCount++
        }

        parsedRecords.push({
          record,
          errors,
          coercions,
          isIndexable,
        })
      } catch (error) {
        // Malformed row - reject
        rejectCount++
        errorCodes[ERROR_CODES.MALFORMED_ROW] = (errorCodes[ERROR_CODES.MALFORMED_ROW] || 0) + 1

        parsedRecords.push({
          record: {
            title: '',
            price: 0,
            inStock: false,
            rawRow: rows[i],
            rowIndex: i,
          },
          errors: [{
            field: '_row',
            code: ERROR_CODES.MALFORMED_ROW,
            message: `Failed to parse row: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          coercions: [],
          isIndexable: false,
        })
      }
    }

    return {
      formatType: this.formatType,
      totalRows: rows.length,
      parsedRecords,
      indexableCount,
      quarantineCount,
      rejectCount,
      errorCodes,
      parseTimeMs: Date.now() - startTime,
    }
  }
}
