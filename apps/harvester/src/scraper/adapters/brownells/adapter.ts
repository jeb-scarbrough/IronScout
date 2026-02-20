import type { ScrapeAdapter } from '../../types.js'
import { pluginToLegacyAdapter } from '../../../ingestion/scrape/runtime/adapter-bridge.js'
import { plugin as brownellsPlugin } from '../../../ingestion/scrape/sites/brownells/index.js'

/**
 * Phase C bridge wrapper:
 * legacy worker fetches HTML, then delegates extract/normalize to plugin contract.
 */
export const brownellsAdapter: ScrapeAdapter = pluginToLegacyAdapter(brownellsPlugin)
