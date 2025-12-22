import { FeedParser, ParsedProduct } from './index'
import { parse as parseCSV } from 'csv-parse/sync'
import { XMLParser } from 'fast-xml-parser'

/**
 * Parser for Impact Radius affiliate feeds
 * Supports CSV, TSV, XML, and JSON formats
 *
 * Impact Product Catalog Fields (official):
 * - CatalogItemId, Name, Description, Bullets, Labels
 * - Manufacturer, Url, MobileUrl, ImageUrl
 * - CurrentPrice, OriginalPrice, DiscountPercentage, Currency
 * - StockAvailability, Gtin, Category, Condition
 * - Gender, AgeGroup, Colors, Material, Pattern, Size, Weight
 * - Text1-3, Money1-3, Numeric1-3 (custom fields)
 *
 * @see https://impact.com Help Center - Product Catalog documentation
 */
export class ImpactParser implements FeedParser {
  async parse(content: string): Promise<ParsedProduct[]> {
    const format = this.detectFormat(content)

    switch (format) {
      case 'csv':
      case 'tsv':
        return this.parseDelimited(content, format)
      case 'xml':
        return this.parseXML(content)
      case 'json':
        return this.parseJSON(content)
      default:
        throw new Error('Unsupported Impact feed format')
    }
  }

  /**
   * Detect feed format from content
   * Checks for XML, JSON, or defaults to delimited (CSV/TSV)
   */
  private detectFormat(content: string): 'csv' | 'tsv' | 'xml' | 'json' {
    const trimmed = content.trim()

    // XML detection
    if (trimmed.startsWith('<')) return 'xml'

    // JSON detection
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json'

    // Check first line for delimiter
    const firstLine = trimmed.split('\n')[0] || ''

    // TSV: tabs are more common than commas in the header
    const tabCount = (firstLine.match(/\t/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length

    return tabCount > commaCount ? 'tsv' : 'csv'
  }

  /**
   * Parse CSV or TSV delimited content
   * Handles Impact's official column names and common variations
   */
  private parseDelimited(content: string, format: 'csv' | 'tsv'): ParsedProduct[] {
    const delimiter = format === 'tsv' ? '\t' : ','

    const records = parseCSV(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter,
      relax_column_count: true, // Handle missing columns gracefully
      relax_quotes: true, // Handle inconsistent quoting
      trim: true, // Trim whitespace from values
    }) as Record<string, string>[]

    return records.map((record) => this.mapRecord(record))
  }

  /**
   * Parse XML format
   */
  private parseXML(content: string): ParsedProduct[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    })

    const result = parser.parse(content)

    // Impact XML structures: <products><product>...</product></products>
    // or <catalog><item>...</item></catalog>
    const products =
      result.products?.product ||
      result.catalog?.item ||
      result.product ||
      result.item ||
      []
    const productArray = Array.isArray(products) ? products : [products]

    return productArray
      .filter((p: unknown) => p && typeof p === 'object')
      .map((product: Record<string, unknown>) => this.mapRecord(product as Record<string, string>))
  }

  /**
   * Parse JSON format
   */
  private parseJSON(content: string): ParsedProduct[] {
    const data = JSON.parse(content)
    const products = Array.isArray(data)
      ? data
      : data.products || data.items || data.catalog || []

    return products
      .filter((p: unknown) => p && typeof p === 'object')
      .map((product: Record<string, unknown>) => this.mapRecord(product as Record<string, string>))
  }

  /**
   * Map a raw record to ParsedProduct using Impact's official field names
   * with fallbacks to common variations
   */
  private mapRecord(record: Record<string, string>): ParsedProduct {
    // Helper to get value with multiple possible keys (case-insensitive)
    const getValue = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        // Try exact match first
        if (record[key] !== undefined && record[key] !== '') {
          return String(record[key])
        }
        // Try case-insensitive match
        const lowerKey = key.toLowerCase()
        for (const recordKey of Object.keys(record)) {
          if (recordKey.toLowerCase() === lowerKey && record[recordKey] !== undefined && record[recordKey] !== '') {
            return String(record[recordKey])
          }
        }
      }
      return undefined
    }

    // Helper to parse decimal values
    const parseDecimal = (...keys: string[]): number | undefined => {
      const value = getValue(...keys)
      if (!value) return undefined
      // Remove currency symbols and parse
      const cleaned = value.replace(/[^0-9.-]/g, '')
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? undefined : parsed
    }

    // Helper to parse integer values
    const parseInteger = (...keys: string[]): number | undefined => {
      const value = getValue(...keys)
      if (!value) return undefined
      const parsed = parseInt(value, 10)
      return isNaN(parsed) ? undefined : parsed
    }

    // Extract core required fields
    const name = getValue('Name', 'ProductName', 'Product Name', 'title') || ''
    const url = getValue('Url', 'URL', 'ProductURL', 'Product URL', 'Link') || ''
    const currentPrice = parseDecimal('CurrentPrice', 'Price', 'Current Price', 'SalePrice') ?? 0

    // Stock availability parsing
    const stockAvailabilityText = getValue('StockAvailability', 'Stock Availability', 'Availability', 'InStock', 'In Stock')
    const inStock = this.parseStockStatus(stockAvailabilityText)

    // Build the parsed product with all Impact fields
    const parsed: ParsedProduct = {
      // Required fields
      retailer: getValue('Manufacturer', 'Brand', 'Advertiser', 'Merchant', 'Vendor') || '',
      name,
      price: currentPrice,
      inStock,
      url,

      // Common optional fields
      upc: getValue('Gtin', 'GTIN', 'UPC', 'EAN', 'ISBN'),
      sku: getValue('CatalogItemId', 'SKU', 'ProductId', 'Product ID', 'MerchantSKU'),
      category: getValue('Category', 'ProductCategory', 'Product Category'),
      brand: getValue('Manufacturer', 'Brand'),
      imageUrl: getValue('ImageUrl', 'ImageURL', 'Image URL', 'Image', 'PrimaryImage'),
      description: getValue('Description', 'ProductDescription', 'Product Description'),

      // Extended Impact fields
      catalogItemId: getValue('CatalogItemId', 'CatalogID', 'ItemId'),
      mobileUrl: getValue('MobileUrl', 'MobileURL', 'Mobile URL'),
      originalPrice: parseDecimal('OriginalPrice', 'Original Price', 'MSRP', 'ListPrice', 'RetailPrice'),
      discountPercentage: parseInteger('DiscountPercentage', 'Discount Percentage', 'Discount'),
      currency: getValue('Currency', 'CurrencyCode') || 'USD',
      stockAvailabilityText,
      condition: getValue('Condition', 'ProductCondition'),
      bullets: getValue('Bullets', 'BulletPoints', 'Features'),
      labels: getValue('Labels', 'Tags', 'Keywords'),
      gender: getValue('Gender'),
      ageGroup: getValue('AgeGroup', 'Age Group'),
      colors: getValue('Colors', 'Color'),
      material: getValue('Material'),
      pattern: getValue('Pattern'),
      size: getValue('Size'),
      weight: getValue('Weight'),

      // Preserve raw data for debugging (limited fields to avoid bloat)
      rawData: this.extractRawData(record),
    }

    return parsed
  }

  /**
   * Extract relevant raw data fields for debugging
   * Includes Text1-3, Money1-3, Numeric1-3 custom fields
   */
  private extractRawData(record: Record<string, string>): Record<string, unknown> {
    const rawData: Record<string, unknown> = {}

    // Extract custom fields (Text1-3, Money1-3, Numeric1-3)
    for (const key of Object.keys(record)) {
      if (/^(Text|Money|Numeric)[123]$/i.test(key)) {
        rawData[key] = record[key]
      }
    }

    return Object.keys(rawData).length > 0 ? rawData : {}
  }

  /**
   * Parse stock availability status from various formats
   * Impact uses free-form text in StockAvailability field
   */
  private parseStockStatus(value: unknown): boolean {
    if (value === undefined || value === null) return true // Default to in stock if not specified
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0

    if (typeof value === 'string') {
      const normalized = value.toLowerCase().trim()

      // Explicit out of stock indicators
      if (
        normalized === 'false' ||
        normalized === 'no' ||
        normalized === '0' ||
        normalized === 'out of stock' ||
        normalized === 'outofstock' ||
        normalized === 'out-of-stock' ||
        normalized === 'unavailable' ||
        normalized === 'sold out' ||
        normalized === 'soldout' ||
        normalized === 'discontinued' ||
        normalized === 'backordered' ||
        normalized === 'preorder' ||
        normalized === 'pre-order'
      ) {
        return false
      }

      // Explicit in stock indicators
      if (
        normalized === 'true' ||
        normalized === 'yes' ||
        normalized === '1' ||
        normalized === 'in stock' ||
        normalized === 'instock' ||
        normalized === 'in-stock' ||
        normalized === 'available' ||
        normalized === 'ready to ship' ||
        normalized === 'ships today'
      ) {
        return true
      }

      // Check for numeric stock quantity (e.g., "25 in stock", "qty: 10")
      const qtyMatch = normalized.match(/(\d+)\s*(in\s*stock|available|qty|units?)?/i)
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[1], 10)
        return qty > 0
      }
    }

    // Default to in stock if we can't determine
    return true
  }
}
