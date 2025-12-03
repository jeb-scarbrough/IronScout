// Base parser interface for affiliate feeds

export interface ParsedProduct {
  retailer: string
  name: string
  price: number
  inStock: boolean
  url: string
  upc?: string
  sku?: string
  category?: string
  brand?: string
  imageUrl?: string
  description?: string
}

export interface FeedParser {
  parse(content: string): Promise<ParsedProduct[]>
}

export { ImpactParser } from './impact'
export { AvantLinkParser } from './avantlink'
export { ShareASaleParser } from './shareasale'
