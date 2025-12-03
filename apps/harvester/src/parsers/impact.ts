import { FeedParser, ParsedProduct } from './index'
import { parse as parseCSV } from 'csv-parse/sync'
import { XMLParser } from 'fast-xml-parser'

/**
 * Parser for Impact Radius affiliate feeds
 * Supports CSV, XML, and JSON formats
 */
export class ImpactParser implements FeedParser {
  async parse(content: string): Promise<ParsedProduct[]> {
    // Detect format
    const format = this.detectFormat(content)

    switch (format) {
      case 'csv':
        return this.parseCSV(content)
      case 'xml':
        return this.parseXML(content)
      case 'json':
        return this.parseJSON(content)
      default:
        throw new Error('Unsupported Impact feed format')
    }
  }

  private detectFormat(content: string): 'csv' | 'xml' | 'json' {
    if (content.trim().startsWith('<')) return 'xml'
    if (content.trim().startsWith('[') || content.trim().startsWith('{')) return 'json'
    return 'csv'
  }

  private parseCSV(content: string): ParsedProduct[] {
    const records = parseCSV(content, {
      columns: true,
      skip_empty_lines: true,
    })

    return records.map((record: any) => ({
      retailer: record['Advertiser'] || record['Merchant'] || '',
      name: record['Product Name'] || record['Name'] || '',
      price: parseFloat(record['Price'] || record['Current Price'] || '0'),
      inStock: this.parseStockStatus(record['In Stock'] || record['Availability']),
      url: record['Product URL'] || record['URL'] || '',
      upc: record['UPC'] || record['GTIN'] || undefined,
      sku: record['SKU'] || record['Merchant SKU'] || undefined,
      category: record['Category'] || record['Product Category'] || undefined,
      brand: record['Brand'] || record['Manufacturer'] || undefined,
      imageUrl: record['Image URL'] || record['Primary Image'] || undefined,
      description: record['Description'] || record['Product Description'] || undefined,
    }))
  }

  private parseXML(content: string): ParsedProduct[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    })

    const result = parser.parse(content)

    // Impact XML typically has structure: <products><product>...</product></products>
    const products = result.products?.product || result.product || []
    const productArray = Array.isArray(products) ? products : [products]

    return productArray.map((product: any) => ({
      retailer: product.advertiser || product.merchant || '',
      name: product.name || product.title || '',
      price: parseFloat(product.price || product.currentPrice || '0'),
      inStock: this.parseStockStatus(product.inStock || product.availability),
      url: product.url || product.productUrl || '',
      upc: product.upc || product.gtin || undefined,
      sku: product.sku || product.merchantSku || undefined,
      category: product.category || product.productCategory || undefined,
      brand: product.brand || product.manufacturer || undefined,
      imageUrl: product.imageUrl || product.primaryImage || undefined,
      description: product.description || product.productDescription || undefined,
    }))
  }

  private parseJSON(content: string): ParsedProduct[] {
    const data = JSON.parse(content)
    const products = Array.isArray(data) ? data : data.products || []

    return products.map((product: any) => ({
      retailer: product.advertiser || product.merchant || '',
      name: product.name || product.productName || '',
      price: parseFloat(product.price || product.currentPrice || '0'),
      inStock: this.parseStockStatus(product.inStock || product.availability),
      url: product.url || product.productUrl || '',
      upc: product.upc || product.gtin || undefined,
      sku: product.sku || product.merchantSku || undefined,
      category: product.category || product.productCategory || undefined,
      brand: product.brand || product.manufacturer || undefined,
      imageUrl: product.imageUrl || product.primaryImage || undefined,
      description: product.description || product.productDescription || undefined,
    }))
  }

  private parseStockStatus(value: any): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.toLowerCase()
      return normalized === 'true' || normalized === 'yes' || normalized === 'in stock' || normalized === '1'
    }
    return false
  }
}
