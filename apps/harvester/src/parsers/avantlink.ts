import { FeedParser, ParsedProduct } from './index'
import { parse as parseCSV } from 'csv-parse/sync'
import { XMLParser } from 'fast-xml-parser'

/**
 * Parser for AvantLink affiliate feeds
 * Supports CSV, XML, and JSON formats
 *
 * AvantLink feed documentation:
 * https://www.avantlink.com/affiliates/productcatalog
 */
export class AvantLinkParser implements FeedParser {
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
        throw new Error('Unsupported AvantLink feed format')
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
      retailer: record['Merchant Name'] || record['Merchant'] || '',
      name: record['Product Name'] || record['Title'] || '',
      price: parseFloat(record['Retail Price'] || record['Price'] || record['Sale Price'] || '0'),
      inStock: this.parseStockStatus(record['Stock Status'] || record['In Stock'] || record['Availability']),
      url: record['Buy URL'] || record['Product URL'] || record['Link'] || '',
      upc: record['UPC Code'] || record['UPC'] || record['EAN'] || undefined,
      sku: record['Merchant Product ID'] || record['SKU'] || undefined,
      category: record['Category Name'] || record['Category'] || undefined,
      brand: record['Brand Name'] || record['Brand'] || record['Manufacturer'] || undefined,
      imageUrl: record['Product Image'] || record['Image URL'] || record['Thumbnail'] || undefined,
      description: record['Product Description'] || record['Description'] || record['Short Description'] || undefined,
    }))
  }

  private parseXML(content: string): ParsedProduct[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    })

    const result = parser.parse(content)

    // AvantLink XML typically has structure: <products><product>...</product></products>
    // or <datafeed><record>...</record></datafeed>
    const products =
      result.products?.product ||
      result.datafeed?.record ||
      result.product ||
      result.record ||
      []
    const productArray = Array.isArray(products) ? products : [products]

    return productArray.map((product: any) => ({
      retailer: product.merchantName || product.merchant || '',
      name: product.productName || product.title || product.name || '',
      price: parseFloat(
        product.retailPrice ||
        product.price ||
        product.salePrice ||
        product.currentPrice ||
        '0'
      ),
      inStock: this.parseStockStatus(
        product.stockStatus ||
        product.inStock ||
        product.availability
      ),
      url: product.buyUrl || product.productUrl || product.url || product.link || '',
      upc: product.upcCode || product.upc || product.ean || undefined,
      sku: product.merchantProductId || product.sku || undefined,
      category: product.categoryName || product.category || undefined,
      brand: product.brandName || product.brand || product.manufacturer || undefined,
      imageUrl: product.productImage || product.imageUrl || product.thumbnail || undefined,
      description: product.productDescription || product.description || product.shortDescription || undefined,
    }))
  }

  private parseJSON(content: string): ParsedProduct[] {
    const data = JSON.parse(content)
    const products = Array.isArray(data) ? data : data.products || data.records || []

    return products.map((product: any) => ({
      retailer: product.merchantName || product.merchant || product.Merchant || '',
      name: product.productName || product.title || product.name || product.Title || '',
      price: parseFloat(
        product.retailPrice ||
        product.price ||
        product.salePrice ||
        product.currentPrice ||
        product.Price ||
        '0'
      ),
      inStock: this.parseStockStatus(
        product.stockStatus ||
        product.inStock ||
        product.availability ||
        product.Availability
      ),
      url: product.buyUrl || product.productUrl || product.url || product.link || product.Link || '',
      upc: product.upcCode || product.upc || product.ean || product.UPC || undefined,
      sku: product.merchantProductId || product.sku || product.SKU || undefined,
      category: product.categoryName || product.category || product.Category || undefined,
      brand: product.brandName || product.brand || product.manufacturer || product.Brand || undefined,
      imageUrl: product.productImage || product.imageUrl || product.thumbnail || product.Image || undefined,
      description:
        product.productDescription ||
        product.description ||
        product.shortDescription ||
        product.Description ||
        undefined,
    }))
  }

  private parseStockStatus(value: any): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.toLowerCase()
      return (
        normalized === 'true' ||
        normalized === 'yes' ||
        normalized === 'in stock' ||
        normalized === 'available' ||
        normalized === '1' ||
        normalized === 'y'
      )
    }
    if (typeof value === 'number') return value > 0
    return false
  }
}
