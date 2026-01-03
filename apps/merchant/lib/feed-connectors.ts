/**
 * Feed Connectors Library
 *
 * Re-exports the connector functionality from harvester for use in merchant portal.
 * This is a lightweight wrapper that imports the connector logic.
 */

import { parse as csvParse } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';
import type { FeedFormatType } from '@ironscout/db';

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedFeedRecord {
  upc?: string;
  sku?: string;
  title: string;
  description?: string;
  brand?: string;
  price: number;
  salePrice?: number;
  caliber?: string;
  grainWeight?: number;
  caseType?: string;
  bulletType?: string;
  roundCount?: number;
  inStock: boolean;
  quantity?: number;
  productUrl?: string;
  imageUrl?: string;
  rawRow: Record<string, unknown>;
  rowIndex: number;
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
  rawValue?: unknown;
}

export interface FieldCoercion {
  field: string;
  rawValue: unknown;
  coercedValue: unknown;
  coercionType: 'trim' | 'numeric' | 'boolean' | 'normalize' | 'default';
}

export interface ParsedRecordResult {
  record: ParsedFeedRecord;
  errors: FieldError[];
  coercions: FieldCoercion[];
  isIndexable: boolean;
}

export interface FeedParseResult {
  formatType: FeedFormatType;
  totalRows: number;
  parsedRecords: ParsedRecordResult[];
  indexableCount: number;
  quarantineCount: number;
  rejectCount: number;
  errorCodes: Record<string, number>;
  parseTimeMs: number;
}

export interface FeedConnector {
  readonly formatType: FeedFormatType;
  readonly name: string;
  canHandle(content: string): boolean;
  parse(content: string): Promise<FeedParseResult>;
  getFieldMapping(): Record<string, string>;
}

// ============================================================================
// ERROR CODES
// ============================================================================

const ERROR_CODES = {
  MISSING_UPC: 'MISSING_UPC',
  INVALID_UPC: 'INVALID_UPC',
  MISSING_TITLE: 'MISSING_TITLE',
  MISSING_PRICE: 'MISSING_PRICE',
  INVALID_PRICE: 'INVALID_PRICE',
  MISSING_CALIBER: 'MISSING_CALIBER',
  MISSING_BRAND: 'MISSING_BRAND',
  PARSE_ERROR: 'PARSE_ERROR',
  MALFORMED_ROW: 'MALFORMED_ROW',
} as const;

// ============================================================================
// CONTENT PARSING
// ============================================================================

type ContentFormat = 'csv' | 'json' | 'xml';

function detectContentFormat(content: string): ContentFormat {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) return 'xml';
  return 'csv';
}

function parseCSV(content: string): Record<string, unknown>[] {
  return csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  });
}

function parseJSON(content: string): Record<string, unknown>[] {
  const data = JSON.parse(content);
  if (Array.isArray(data)) return data;
  if (data.products && Array.isArray(data.products)) return data.products;
  if (data.items && Array.isArray(data.items)) return data.items;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.offers && Array.isArray(data.offers)) return data.offers;
  return [data];
}

function parseXML(content: string): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '_text',
  });
  const result = parser.parse(content);
  const items =
    result.products?.product ||
    result.feed?.products?.product ||
    result.feed?.entry ||
    result.rss?.channel?.item ||
    result.items?.item ||
    result.catalog?.product ||
    result.offers?.offer ||
    [];
  return Array.isArray(items) ? items : [items];
}

function parseContent(content: string): Record<string, unknown>[] {
  const format = detectContentFormat(content);
  switch (format) {
    case 'csv': return parseCSV(content);
    case 'json': return parseJSON(content);
    case 'xml': return parseXML(content);
  }
}

// ============================================================================
// VALUE EXTRACTION
// ============================================================================

function extractString(
  row: Record<string, unknown>,
  fields: string[],
  coercions: FieldCoercion[],
  targetField: string
): string | undefined {
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null && value !== '') {
      const stringVal = String(value).trim();
      if (stringVal !== String(value)) {
        coercions.push({ field: targetField, rawValue: value, coercedValue: stringVal, coercionType: 'trim' });
      }
      return stringVal || undefined;
    }
  }
  return undefined;
}

function extractNumber(
  row: Record<string, unknown>,
  fields: string[],
  coercions: FieldCoercion[],
  targetField: string
): number | undefined {
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'number') return value;
      const cleaned = String(value).replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        coercions.push({ field: targetField, rawValue: value, coercedValue: parsed, coercionType: 'numeric' });
        return parsed;
      }
    }
  }
  return undefined;
}

function extractBoolean(
  row: Record<string, unknown>,
  fields: string[],
  coercions: FieldCoercion[],
  targetField: string,
  defaultValue: boolean = true
): boolean {
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null) {
      if (typeof value === 'boolean') return value;
      const strVal = String(value).toLowerCase().trim();
      const boolResult = strVal === 'true' || strVal === '1' || strVal === 'yes' || strVal === 'in stock' || strVal === 'available' || strVal === 'y';
      coercions.push({ field: targetField, rawValue: value, coercedValue: boolResult, coercionType: 'boolean' });
      return boolResult;
    }
  }
  return defaultValue;
}

function validateUPC(upc: string | undefined): string | null {
  if (!upc) return null;
  let cleaned = upc.replace(/^(UPC:|GTIN:)/i, '').trim();
  cleaned = cleaned.replace(/[^0-9]/g, '');
  if (cleaned.length >= 8 && cleaned.length <= 14) return cleaned;
  return null;
}

// ============================================================================
// GENERIC CONNECTOR
// ============================================================================

const TITLE_FIELDS = ['title', 'name', 'product_name', 'productName', 'product_title', 'productTitle', 'item_name', 'itemName', 'description', 'product'];
const PRICE_FIELDS = ['price', 'sale_price', 'salePrice', 'current_price', 'currentPrice', 'retail_price', 'retailPrice', 'unit_price', 'unitPrice', 'cost'];
const UPC_FIELDS = ['upc', 'UPC', 'gtin', 'GTIN', 'ean', 'EAN', 'barcode', 'product_id', 'productId', 'universal_product_code', 'upc_code', 'upcCode'];
const SKU_FIELDS = ['sku', 'SKU', 'item_sku', 'itemSku', 'product_sku', 'productSku', 'item_id', 'itemId', 'model', 'part_number', 'partNumber', 'mpn'];
const DESCRIPTION_FIELDS = ['description', 'desc', 'product_description', 'productDescription', 'long_description', 'longDescription', 'details', 'summary'];
const BRAND_FIELDS = ['brand', 'manufacturer', 'mfg', 'make', 'vendor', 'brand_name', 'brandName', 'manufacturer_name', 'manufacturerName'];
const CALIBER_FIELDS = ['caliber', 'calibre', 'gauge', 'cartridge', 'ammunition_type', 'ammo_type', 'ammoType', 'bullet_caliber', 'bulletCaliber'];
const GRAIN_FIELDS = ['grain', 'grain_weight', 'grainWeight', 'bullet_weight', 'bulletWeight', 'weight', 'grains'];
const CASE_FIELDS = ['case_type', 'caseType', 'case_material', 'caseMaterial', 'casing', 'case', 'shell_type', 'shellType'];
const BULLET_TYPE_FIELDS = ['bullet_type', 'bulletType', 'projectile', 'projectile_type', 'projectileType', 'ammo_style', 'ammoStyle', 'round_type', 'roundType'];
const ROUND_COUNT_FIELDS = ['round_count', 'roundCount', 'rounds', 'pack_size', 'packSize', 'quantity', 'count', 'box_count', 'boxCount', 'num_rounds', 'numRounds'];
const STOCK_FIELDS = ['in_stock', 'inStock', 'availability', 'stock_status', 'stockStatus', 'available', 'is_available', 'isAvailable', 'stock'];
const URL_FIELDS = ['url', 'link', 'product_url', 'productUrl', 'product_link', 'productLink', 'page_url', 'pageUrl', 'buy_link', 'buyLink'];
const IMAGE_FIELDS = ['image_url', 'imageUrl', 'image', 'image_link', 'imageLink', 'photo', 'picture', 'thumbnail', 'main_image', 'mainImage', 'product_image', 'productImage'];

class GenericConnector implements FeedConnector {
  readonly formatType: FeedFormatType = 'GENERIC';
  readonly name = 'Auto-Detect Generic Format';

  canHandle(): boolean {
    return true;
  }

  getFieldMapping(): Record<string, string> {
    return { title: 'Various', price: 'Various', upc: 'Various' };
  }

  async parse(content: string): Promise<FeedParseResult> {
    const startTime = Date.now();
    const rows = parseContent(content);
    const parsedRecords: ParsedRecordResult[] = [];
    const errorCodes: Record<string, number> = {};
    let indexableCount = 0;
    let quarantineCount = 0;
    let rejectCount = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const errors: FieldError[] = [];
        const coercions: FieldCoercion[] = [];

        const rawUpc = extractString(row, UPC_FIELDS, coercions, 'upc');
        const upc = validateUPC(rawUpc) || undefined;

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
          productUrl: extractString(row, URL_FIELDS, coercions, 'productUrl'),
          imageUrl: extractString(row, IMAGE_FIELDS, coercions, 'imageUrl'),
          rawRow: row,
          rowIndex: i,
        };

        const hasValidUPC = !!record.upc;
        const hasRequiredFields = !!record.title && record.price > 0;
        const isIndexable = hasValidUPC && hasRequiredFields;

        if (!hasValidUPC) {
          errors.push({ field: 'upc', code: ERROR_CODES.MISSING_UPC, message: 'Missing or invalid UPC' });
        }
        if (!record.title) {
          errors.push({ field: 'title', code: ERROR_CODES.MISSING_TITLE, message: 'Missing product title' });
        }
        if (!record.price || record.price <= 0) {
          errors.push({ field: 'price', code: ERROR_CODES.INVALID_PRICE, message: 'Missing or invalid price' });
        }

        for (const error of errors) {
          errorCodes[error.code] = (errorCodes[error.code] || 0) + 1;
        }

        if (isIndexable) {
          indexableCount++;
        } else if (hasRequiredFields && !hasValidUPC) {
          quarantineCount++;
        } else {
          rejectCount++;
        }

        parsedRecords.push({ record, errors, coercions, isIndexable });
      } catch {
        rejectCount++;
        errorCodes[ERROR_CODES.MALFORMED_ROW] = (errorCodes[ERROR_CODES.MALFORMED_ROW] || 0) + 1;
        parsedRecords.push({
          record: { title: '', price: 0, inStock: false, rawRow: rows[i], rowIndex: i },
          errors: [{ field: '_row', code: ERROR_CODES.MALFORMED_ROW, message: 'Failed to parse row' }],
          coercions: [],
          isIndexable: false,
        });
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
    };
  }
}

// ============================================================================
// CONNECTOR REGISTRY
// ============================================================================

const genericConnector = new GenericConnector();

const connectorRegistry: Map<FeedFormatType, FeedConnector> = new Map([
  ['GENERIC', genericConnector],
  ['AMMOSEEK_V1', genericConnector], // Use generic for now
  ['GUNENGINE_V2', genericConnector], // Use generic for now
]);

export function getConnector(formatType: FeedFormatType): FeedConnector {
  return connectorRegistry.get(formatType) || genericConnector;
}

export function detectConnector(content: string): FeedConnector {
  // For test-run, always use generic since we just need to parse
  return genericConnector;
}
