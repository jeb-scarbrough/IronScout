/**
 * Feed Connector Types
 *
 * Defines the interface and types for feed connectors that parse
 * dealer product feeds in various formats.
 */

import type { FeedFormatType } from '@ironscout/db'

// ============================================================================
// PARSED RECORD TYPES
// ============================================================================

/**
 * Represents a single parsed record from a feed.
 * Contains both extracted fields and validation metadata.
 */
export interface ParsedFeedRecord {
  // Core identity (UPC required for indexing)
  upc?: string
  sku?: string

  // Product info
  title: string
  description?: string
  brand?: string

  // Pricing
  price: number
  salePrice?: number

  // Ammo-specific attributes
  caliber?: string
  grainWeight?: number
  caseType?: string
  bulletType?: string
  roundCount?: number

  // Availability
  inStock: boolean
  quantity?: number

  // URLs
  productUrl?: string
  imageUrl?: string

  // Raw data preserved for corrections/debugging
  rawRow: Record<string, unknown>
  rowIndex: number
}

/**
 * Validation error for a specific field
 */
export interface FieldError {
  field: string
  code: string
  message: string
  rawValue?: unknown
}

/**
 * Coercion that was applied to transform a raw value
 */
export interface FieldCoercion {
  field: string
  rawValue: unknown
  coercedValue: unknown
  coercionType: 'trim' | 'numeric' | 'boolean' | 'normalize' | 'default'
}

/**
 * Result of parsing a single record
 */
export interface ParsedRecordResult {
  record: ParsedFeedRecord
  errors: FieldError[]
  coercions: FieldCoercion[]
  isIndexable: boolean  // Has valid UPC and required fields
}

// ============================================================================
// PARSE RESULT TYPES
// ============================================================================

/**
 * Aggregated result of parsing an entire feed
 */
export interface FeedParseResult {
  formatType: FeedFormatType
  totalRows: number
  parsedRecords: ParsedRecordResult[]

  // Summary counts
  indexableCount: number
  quarantineCount: number
  rejectCount: number

  // Error summary
  errorCodes: Record<string, number>

  // Timing
  parseTimeMs: number
}

// ============================================================================
// CONNECTOR INTERFACE
// ============================================================================

/**
 * Feed Connector Interface
 *
 * Each format type (GENERIC, AMMOSEEK_V1, GUNENGINE_V2) implements this interface
 * to handle format-specific parsing logic.
 */
export interface FeedConnector {
  /**
   * The format type this connector handles
   */
  readonly formatType: FeedFormatType

  /**
   * Human-readable name for the connector
   */
  readonly name: string

  /**
   * Detect if this connector can handle the given content
   * @param content Raw feed content
   * @returns true if this connector can parse the content
   */
  canHandle(content: string): boolean

  /**
   * Parse raw feed content into structured records
   * @param content Raw feed content (CSV, JSON, XML)
   * @returns Parsed feed result with records and validation info
   */
  parse(content: string): Promise<FeedParseResult>

  /**
   * Get the expected column/field mapping for this format
   * Used for documentation and debugging
   */
  getFieldMapping(): Record<string, string>
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // Identity errors (cause quarantine)
  MISSING_UPC: 'MISSING_UPC',
  INVALID_UPC: 'INVALID_UPC',

  // Required field errors (cause rejection)
  MISSING_TITLE: 'MISSING_TITLE',
  MISSING_PRICE: 'MISSING_PRICE',
  INVALID_PRICE: 'INVALID_PRICE',

  // Data quality warnings
  MISSING_CALIBER: 'MISSING_CALIBER',
  MISSING_BRAND: 'MISSING_BRAND',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  INVALID_GRAIN: 'INVALID_GRAIN',

  // Format errors
  PARSE_ERROR: 'PARSE_ERROR',
  MALFORMED_ROW: 'MALFORMED_ROW',
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
