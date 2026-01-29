/**
 * Adapter Registry
 *
 * Per scraper-framework-01 spec v0.5 §5.4
 *
 * Registry for scrape adapters. Adapters must be explicitly registered; no auto-discovery.
 */

import type { ScrapeAdapter, AdapterRegistry } from './types.js'

/**
 * In-memory adapter registry implementation.
 * Adapters are registered at startup and remain immutable during runtime.
 */
export class InMemoryAdapterRegistry implements AdapterRegistry {
  private readonly adapters = new Map<string, ScrapeAdapter>()
  private readonly domainToAdapter = new Map<string, ScrapeAdapter>()

  /**
   * Register an adapter.
   * @throws Error if adapter with same ID already registered
   * @throws Error if adapter for same domain already registered
   */
  register(adapter: ScrapeAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter with ID '${adapter.id}' is already registered`)
    }

    if (this.domainToAdapter.has(adapter.domain)) {
      const existing = this.domainToAdapter.get(adapter.domain)!
      throw new Error(
        `Adapter for domain '${adapter.domain}' is already registered as '${existing.id}'`
      )
    }

    this.adapters.set(adapter.id, adapter)
    this.domainToAdapter.set(adapter.domain, adapter)
  }

  /**
   * Get adapter by ID.
   */
  get(adapterId: string): ScrapeAdapter | undefined {
    return this.adapters.get(adapterId)
  }

  /**
   * List all registered adapter IDs.
   */
  list(): string[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Check if adapter exists for domain.
   */
  hasAdapterForDomain(domain: string): boolean {
    return this.domainToAdapter.has(domain)
  }

  /**
   * Get adapter by domain.
   */
  getByDomain(domain: string): ScrapeAdapter | undefined {
    return this.domainToAdapter.get(domain)
  }

  /**
   * Get count of registered adapters.
   */
  size(): number {
    return this.adapters.size
  }
}

// Global singleton registry instance
let globalRegistry: InMemoryAdapterRegistry | null = null

/**
 * Get or create the global adapter registry.
 * Use this for runtime adapter lookup.
 */
export function getAdapterRegistry(): InMemoryAdapterRegistry {
  if (!globalRegistry) {
    globalRegistry = new InMemoryAdapterRegistry()
  }
  return globalRegistry
}

/**
 * Reset the global registry (for testing).
 */
export function resetAdapterRegistry(): void {
  globalRegistry = null
}
