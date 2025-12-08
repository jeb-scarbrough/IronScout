/**
 * Dealer Feed Ingestion Worker
 * 
 * Downloads and parses dealer product feeds, creating/updating DealerSku records.
 * Supports CSV, XML, and JSON formats.
 */

import { Worker, Job } from 'bullmq'
import { prisma } from '@ironscout/db'
import { redisConnection } from '../config/redis'
import { 
  QUEUE_NAMES, 
  DealerFeedIngestJobData, 
  dealerSkuMatchQueue 
} from '../config/queues'
import { createHash } from 'crypto'
import { parse as csvParse } from 'csv-parse/sync'
import { XMLParser } from 'fast-xml-parser'

// ============================================================================
// TYPES
// ============================================================================

interface RawFeedItem {
  title?: string
  name?: string
  product_name?: string
  
  price?: string | number
  sale_price?: string | number
  
  description?: string
  product_description?: string
  
  upc?: string
  sku?: string
  product_id?: string
  
  caliber?: string
  grain?: string | number
  grain_weight?: string | number
  
  case_type?: string
  case_material?: string
  casing?: string
  
  bullet_type?: string
  projectile?: string
  
  brand?: string
  manufacturer?: string
  
  pack_size?: string | number
  quantity?: string | number
  count?: string | number
  
  in_stock?: string | boolean | number
  availability?: string
  stock_status?: string
  
  url?: string
  link?: string
  product_url?: string
  
  image_url?: string
  image?: string
  image_link?: string
}

interface ParsedFeedItem {
  rawTitle: string
  rawDescription?: string
  rawPrice: number
  rawUpc?: string
  rawSku?: string
  rawCaliber?: string
  rawGrain?: string
  rawCase?: string
  rawBulletType?: string
  rawBrand?: string
  rawPackSize?: number
  rawInStock: boolean
  rawUrl?: string
  rawImageUrl?: string
}

// ============================================================================
// FEED FETCHING
// ============================================================================

async function fetchFeed(
  url: string,
  feedType: string,
  username?: string,
  password?: string
): Promise<string> {
  const headers: Record<string, string> = {}
  
  if (feedType === 'AUTH_URL' && username && password) {
    const auth = Buffer.from(`${username}:${password}`).toString('base64')
    headers['Authorization'] = `Basic ${auth}`
  }
  
  const response = await fetch(url, { headers })
  
  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status} ${response.statusText}`)
  }
  
  return response.text()
}

// ============================================================================
// FEED PARSING
// ============================================================================

function detectFormat(content: string): 'csv' | 'xml' | 'json' {
  const trimmed = content.trim()
  
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }
  
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return 'xml'
  }
  
  return 'csv'
}

function parseCSV(content: string): RawFeedItem[] {
  try {
    return csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  } catch (error) {
    console.error('CSV parse error:', error)
    throw new Error('Failed to parse CSV feed')
  }
}

function parseXML(content: string): RawFeedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  })
  
  try {
    const result = parser.parse(content)
    
    // Try common XML structures
    const items = 
      result.products?.product ||
      result.feed?.products?.product ||
      result.rss?.channel?.item ||
      result.items?.item ||
      result.catalog?.product ||
      []
    
    return Array.isArray(items) ? items : [items]
  } catch (error) {
    console.error('XML parse error:', error)
    throw new Error('Failed to parse XML feed')
  }
}

function parseJSON(content: string): RawFeedItem[] {
  try {
    const data = JSON.parse(content)
    
    // Handle various JSON structures
    if (Array.isArray(data)) {
      return data
    }
    
    if (data.products && Array.isArray(data.products)) {
      return data.products
    }
    
    if (data.items && Array.isArray(data.items)) {
      return data.items
    }
    
    if (data.data && Array.isArray(data.data)) {
      return data.data
    }
    
    return [data]
  } catch (error) {
    console.error('JSON parse error:', error)
    throw new Error('Failed to parse JSON feed')
  }
}

function parseFeedContent(content: string): RawFeedItem[] {
  const format = detectFormat(content)
  
  switch (format) {
    case 'csv':
      return parseCSV(content)
    case 'xml':
      return parseXML(content)
    case 'json':
      return parseJSON(content)
    default:
      throw new Error(`Unsupported feed format: ${format}`)
  }
}

// ============================================================================
// ITEM NORMALIZATION
// ============================================================================

function normalizeItem(raw: RawFeedItem): ParsedFeedItem | null {
  // Extract title
  const title = raw.title || raw.name || raw.product_name
  if (!title) {
    return null // Skip items without a title
  }
  
  // Extract and validate price
  const rawPrice = raw.sale_price || raw.price
  const price = typeof rawPrice === 'number' 
    ? rawPrice 
    : parseFloat(String(rawPrice || '').replace(/[^0-9.]/g, ''))
  
  if (isNaN(price) || price <= 0) {
    return null // Skip items without valid price
  }
  
  // Extract stock status
  const stockValue = raw.in_stock ?? raw.availability ?? raw.stock_status ?? true
  const inStock = 
    stockValue === true ||
    stockValue === 1 ||
    stockValue === '1' ||
    String(stockValue).toLowerCase() === 'true' ||
    String(stockValue).toLowerCase() === 'in stock' ||
    String(stockValue).toLowerCase() === 'available'
  
  // Extract pack size
  const packSizeRaw = raw.pack_size || raw.quantity || raw.count
  const packSize = packSizeRaw ? parseInt(String(packSizeRaw), 10) : undefined
  
  // Extract grain
  const grainRaw = raw.grain || raw.grain_weight
  const grain = grainRaw ? String(grainRaw) : undefined
  
  return {
    rawTitle: String(title).trim(),
    rawDescription: raw.description || raw.product_description || undefined,
    rawPrice: price,
    rawUpc: raw.upc || undefined,
    rawSku: raw.sku || raw.product_id || undefined,
    rawCaliber: raw.caliber || undefined,
    rawGrain: grain,
    rawCase: raw.case_type || raw.case_material || raw.casing || undefined,
    rawBulletType: raw.bullet_type || raw.projectile || undefined,
    rawBrand: raw.brand || raw.manufacturer || undefined,
    rawPackSize: packSize && packSize > 0 ? packSize : undefined,
    rawInStock: inStock,
    rawUrl: raw.url || raw.link || raw.product_url || undefined,
    rawImageUrl: raw.image_url || raw.image || raw.image_link || undefined,
  }
}

// ============================================================================
// SKU HASH FOR DEDUPLICATION
// ============================================================================

function generateSkuHash(item: ParsedFeedItem): string {
  // Create a hash based on key identifying attributes
  const components = [
    item.rawTitle.toLowerCase().trim(),
    item.rawUpc || '',
    item.rawSku || '',
    String(item.rawPrice),
  ]
  
  const hash = createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
  
  return hash.substring(0, 32)
}

// ============================================================================
// WORKER
// ============================================================================

async function processFeedIngest(job: Job<DealerFeedIngestJobData>) {
  const { dealerId, feedId, feedRunId, feedType, url, username, password } = job.data
  
  const startTime = Date.now()
  const errors: Array<{ row: number; error: string }> = []
  let rowCount = 0
  let processedCount = 0
  let matchedCount = 0
  let failedCount = 0
  
  try {
    // Update feed run status
    await prisma.dealerFeedRun.update({
      where: { id: feedRunId },
      data: { status: 'RUNNING' },
    })
    
    // Fetch feed content
    if (!url) {
      throw new Error('Feed URL is required')
    }
    
    console.log(`[Dealer Feed] Fetching feed for dealer ${dealerId}`)
    const content = await fetchFeed(url, feedType, username, password)
    
    // Calculate content hash for change detection
    const contentHash = createHash('sha256').update(content).digest('hex')
    
    // Check if content has changed
    const feed = await prisma.dealerFeed.findUnique({
      where: { id: feedId },
    })
    
    if (feed?.feedHash === contentHash) {
      console.log(`[Dealer Feed] No changes detected for dealer ${dealerId}`)
      await prisma.dealerFeedRun.update({
        where: { id: feedRunId },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration: Date.now() - startTime,
          rowCount: 0,
          processedCount: 0,
        },
      })
      return { skipped: true, reason: 'no_changes' }
    }
    
    // Parse feed
    console.log(`[Dealer Feed] Parsing feed for dealer ${dealerId}`)
    const rawItems = parseFeedContent(content)
    rowCount = rawItems.length
    
    console.log(`[Dealer Feed] Found ${rowCount} items in feed`)
    
    // Process items
    const dealerSkuIds: string[] = []
    
    for (let i = 0; i < rawItems.length; i++) {
      try {
        const normalized = normalizeItem(rawItems[i])
        
        if (!normalized) {
          errors.push({ row: i + 1, error: 'Missing required fields (title or price)' })
          failedCount++
          continue
        }
        
        const skuHash = generateSkuHash(normalized)
        
        // Upsert DealerSku
        const dealerSku = await prisma.dealerSku.upsert({
          where: {
            dealerId_dealerSkuHash: {
              dealerId,
              dealerSkuHash: skuHash,
            },
          },
          create: {
            dealerId,
            feedId,
            feedRunId,
            dealerSkuHash: skuHash,
            ...normalized,
            isActive: true,
          },
          update: {
            feedRunId,
            rawPrice: normalized.rawPrice,
            rawInStock: normalized.rawInStock,
            rawDescription: normalized.rawDescription,
            rawImageUrl: normalized.rawImageUrl,
            isActive: true,
            updatedAt: new Date(),
          },
        })
        
        dealerSkuIds.push(dealerSku.id)
        processedCount++
        
        // Log progress every 100 items
        if (processedCount % 100 === 0) {
          console.log(`[Dealer Feed] Processed ${processedCount}/${rowCount} items`)
        }
      } catch (error) {
        errors.push({ row: i + 1, error: String(error) })
        failedCount++
      }
    }
    
    // Mark SKUs not in this feed run as inactive
    await prisma.dealerSku.updateMany({
      where: {
        dealerId,
        feedId,
        feedRunId: { not: feedRunId },
        isActive: true,
      },
      data: { isActive: false },
    })
    
    // Update feed hash
    await prisma.dealerFeed.update({
      where: { id: feedId },
      data: {
        feedHash: contentHash,
        lastSuccessAt: new Date(),
        lastError: null,
        status: failedCount > rowCount * 0.1 ? 'WARNING' : 'HEALTHY',
      },
    })
    
    // Update feed run
    await prisma.dealerFeedRun.update({
      where: { id: feedRunId },
      data: {
        status: failedCount > rowCount * 0.5 ? 'WARNING' : 'SUCCESS',
        completedAt: new Date(),
        duration: Date.now() - startTime,
        rowCount,
        processedCount,
        failedCount,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined, // Limit stored errors
      },
    })
    
    // Queue SKU matching in batches
    const BATCH_SIZE = 100
    for (let i = 0; i < dealerSkuIds.length; i += BATCH_SIZE) {
      const batch = dealerSkuIds.slice(i, i + BATCH_SIZE)
      await dealerSkuMatchQueue.add(
        'match-batch',
        {
          dealerId,
          feedRunId,
          dealerSkuIds: batch,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }
      )
    }
    
    console.log(`[Dealer Feed] Completed: ${processedCount} processed, ${failedCount} failed`)
    
    return {
      rowCount,
      processedCount,
      failedCount,
      duration: Date.now() - startTime,
    }
    
  } catch (error) {
    console.error(`[Dealer Feed] Error for dealer ${dealerId}:`, error)
    
    // Update feed status
    await prisma.dealerFeed.update({
      where: { id: feedId },
      data: {
        lastFailureAt: new Date(),
        lastError: String(error),
        status: 'FAILED',
      },
    })
    
    // Update feed run
    await prisma.dealerFeedRun.update({
      where: { id: feedRunId },
      data: {
        status: 'FAILURE',
        completedAt: new Date(),
        duration: Date.now() - startTime,
        errors: [{ row: 0, error: String(error) }],
      },
    })
    
    throw error
  }
}

// ============================================================================
// WORKER EXPORT
// ============================================================================

export const dealerFeedIngestWorker = new Worker(
  QUEUE_NAMES.DEALER_FEED_INGEST,
  processFeedIngest,
  {
    connection: redisConnection,
    concurrency: 5,
  }
)

dealerFeedIngestWorker.on('completed', (job) => {
  console.log(`[Dealer Feed] Job ${job.id} completed`)
})

dealerFeedIngestWorker.on('failed', (job, error) => {
  console.error(`[Dealer Feed] Job ${job?.id} failed:`, error)
})
