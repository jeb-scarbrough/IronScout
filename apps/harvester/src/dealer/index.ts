/**
 * Dealer Portal Workers - Index
 * 
 * Exports all dealer-related workers for the harvester.
 */

export { dealerFeedIngestWorker } from './feed-ingest'
export { dealerSkuMatchWorker } from './sku-match'
export { dealerBenchmarkWorker } from './benchmark'
export { dealerInsightWorker } from './insight'

// Re-export queue references for scheduling
export {
  dealerFeedIngestQueue,
  dealerSkuMatchQueue,
  dealerBenchmarkQueue,
  dealerInsightQueue,
} from '../config/queues'
