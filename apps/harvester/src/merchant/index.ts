/**
 * Merchant Portal Workers - Index
 *
 * Exports all merchant-related workers for the harvester.
 */

export { merchantFeedIngestWorker } from './feed-ingest'
export { merchantSkuMatchWorker } from './sku-match'
export { merchantBenchmarkWorker } from './benchmark'
export { merchantInsightWorker } from './insight'

// Re-export queue references for scheduling
export {
  merchantFeedIngestQueue,
  merchantSkuMatchQueue,
  merchantBenchmarkQueue,
  merchantInsightQueue,
} from '../config/queues'
