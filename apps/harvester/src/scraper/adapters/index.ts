/**
 * Adapter Registration
 *
 * Per scraper-framework-01 spec v0.5 §5.4
 *
 * Registers all production adapters with the global registry.
 * Import this module at worker startup to enable adapters.
 *
 * Adapters are explicitly registered here - no auto-discovery.
 */

import { getAdapterRegistry } from '../registry.js'

// Import all adapters
import { sgammoAdapter } from './sgammo/index.js'
import { primaryarmsAdapter } from './primaryarms/index.js'
import { midwayusaAdapter } from './midwayusa/index.js'
import { brownellsAdapter } from './brownells/index.js'

/**
 * Register all production adapters.
 * Call this once at worker startup.
 */
export function registerAllAdapters(): void {
  const registry = getAdapterRegistry()

  // Register SGAmmo adapter
  registry.register(sgammoAdapter)
  registry.register(primaryarmsAdapter)

  registry.register(midwayusaAdapter)
  registry.register(brownellsAdapter)
  // Future adapters register here:
  // registry.register(ammoseekAdapter)
  // registry.register(luckygunnerAdapter)
}

// Re-export adapters for direct access (e.g., in tests)
export { sgammoAdapter } from './sgammo/index.js'
export { primaryarmsAdapter } from './primaryarms/index.js'
export { midwayusaAdapter } from './midwayusa/index.js'
export { brownellsAdapter } from './brownells/index.js'
