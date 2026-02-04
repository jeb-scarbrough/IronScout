/**
 * Robots.txt Policy Implementation
 *
 * Per scraper-framework-01 spec v0.5 §6.3
 *
 * Policy rules:
 * 1. Obey all Disallow rules for `User-agent: *` and `User-agent: IronScout`
 * 2. Honor Crawl-delay (min 1s, max 60s, default 2s if not specified)
 * 3. If robots.txt unavailable after 3 retries: fail closed (block domain)
 * 4. Cache robots.txt for 24 hours
 * 5. If robots.txt changes to Disallow: stop on next refresh
 */

import type { RobotsPolicy } from '../types.js'
import { DEFAULT_FETCH_HEADERS } from '../types.js'
import { getRegistrableDomain } from '../utils/url.js'

/**
 * Parsed robots.txt rules for a domain.
 */
interface RobotsRules {
  /** Paths disallowed for User-agent: * */
  globalDisallowed: string[]
  /** Paths disallowed for User-agent: IronScout */
  agentDisallowed: string[]
  /** Crawl-delay in seconds (null if not specified) */
  crawlDelay: number | null
  /** When this cache entry was created */
  cachedAt: number
  /** Whether robots.txt fetch was successful */
  fetchSucceeded: boolean
}

export interface RobotsPolicyOptions {
  /** Cache TTL in ms (default: 24 hours) */
  cacheTtlMs?: number
  /** Number of fetch retries (default: 3) */
  fetchRetries?: number
  /** Request timeout in ms (default: 10000) */
  fetchTimeoutMs?: number
  /** Our User-Agent name for matching rules */
  userAgentName?: string
  /** Default crawl delay in seconds if not specified (default: 2) */
  defaultCrawlDelay?: number
  /** Min crawl delay in seconds (default: 1) */
  minCrawlDelay?: number
  /** Max crawl delay in seconds (default: 60) */
  maxCrawlDelay?: number
}

const DEFAULT_OPTIONS: Required<RobotsPolicyOptions> = {
  cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  fetchRetries: 3,
  fetchTimeoutMs: 10000,
  userAgentName: 'IronScout',
  defaultCrawlDelay: 2,
  minCrawlDelay: 1,
  maxCrawlDelay: 60,
}

/**
 * Robots.txt policy implementation with caching.
 * Fail-closed: if we can't fetch robots.txt, block the domain.
 */
export class RobotsPolicyImpl implements RobotsPolicy {
  private readonly options: Required<RobotsPolicyOptions>
  private readonly cache = new Map<string, RobotsRules>()

  constructor(options: RobotsPolicyOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Check if URL is allowed by robots.txt.
   * Returns false if disallowed OR unavailable (fail-closed).
   */
  async isAllowed(url: string): Promise<boolean> {
    const domain = getRegistrableDomain(url)
    const rules = await this.getRules(domain)

    // Fail-closed: if fetch failed, block the URL
    if (!rules.fetchSucceeded) {
      return false
    }

    const urlObj = new URL(url)
    const path = urlObj.pathname + urlObj.search

    // Check agent-specific rules first (more specific)
    if (this.matchesAnyRule(path, rules.agentDisallowed)) {
      return false
    }

    // Check global rules
    if (this.matchesAnyRule(path, rules.globalDisallowed)) {
      return false
    }

    return true
  }

  /**
   * Get crawl delay from robots.txt.
   */
  async getCrawlDelay(domain: string): Promise<number | null> {
    const rules = await this.getRules(domain)

    if (rules.crawlDelay !== null) {
      return Math.max(
        this.options.minCrawlDelay,
        Math.min(this.options.maxCrawlDelay, rules.crawlDelay)
      )
    }

    return this.options.defaultCrawlDelay
  }

  /**
   * Get rules for a domain, fetching if not cached.
   */
  private async getRules(domain: string): Promise<RobotsRules> {
    const cached = this.cache.get(domain)
    const now = Date.now()

    if (cached && now - cached.cachedAt < this.options.cacheTtlMs) {
      return cached
    }

    const rules = await this.fetchAndParseRobots(domain)
    this.cache.set(domain, rules)
    return rules
  }

  /**
   * Fetch and parse robots.txt for a domain.
   */
  private async fetchAndParseRobots(domain: string): Promise<RobotsRules> {
    const robotsUrl = `https://${domain}/robots.txt`
    let text: string | null = null

    for (let attempt = 1; attempt <= this.options.fetchRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.options.fetchTimeoutMs)

        const response = await fetch(robotsUrl, {
          method: 'GET',
          headers: { 'User-Agent': DEFAULT_FETCH_HEADERS['User-Agent'] },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // 404 = no robots.txt = allow all
        if (response.status === 404) {
          return {
            globalDisallowed: [],
            agentDisallowed: [],
            crawlDelay: null,
            cachedAt: Date.now(),
            fetchSucceeded: true,
          }
        }

        if (response.ok) {
          text = await response.text()
          break
        }

        // Non-404 error, retry
      } catch {
        // Network error, retry
      }

      // Wait before retry
      if (attempt < this.options.fetchRetries) {
        await this.sleep(1000 * attempt)
      }
    }

    // Fail-closed: if we couldn't fetch, block the domain
    if (text === null) {
      return {
        globalDisallowed: ['*'], // Block everything
        agentDisallowed: [],
        crawlDelay: null,
        cachedAt: Date.now(),
        fetchSucceeded: false,
      }
    }

    return this.parseRobotsTxt(text)
  }

  /**
   * Parse robots.txt content.
   */
  private parseRobotsTxt(text: string): RobotsRules {
    const rules: RobotsRules = {
      globalDisallowed: [],
      agentDisallowed: [],
      crawlDelay: null,
      cachedAt: Date.now(),
      fetchSucceeded: true,
    }

    const lines = text.split('\n')
    let currentAgents: string[] = []

    for (const rawLine of lines) {
      const line = rawLine.trim()

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue
      }

      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue

      const directive = line.slice(0, colonIndex).trim().toLowerCase()
      const value = line.slice(colonIndex + 1).trim()

      if (directive === 'user-agent') {
        // New user-agent section
        const agent = value.toLowerCase()
        if (currentAgents.length === 0 || !['disallow', 'allow', 'crawl-delay'].includes(directive)) {
          currentAgents = [agent]
        } else {
          currentAgents.push(agent)
        }
      } else if (directive === 'disallow') {
        if (!value) continue // Empty disallow = allow all

        const isGlobal = currentAgents.includes('*')
        const isOurAgent = currentAgents.includes(this.options.userAgentName.toLowerCase())

        if (isOurAgent) {
          rules.agentDisallowed.push(value)
        } else if (isGlobal) {
          rules.globalDisallowed.push(value)
        }
      } else if (directive === 'crawl-delay') {
        const isOurAgent = currentAgents.includes(this.options.userAgentName.toLowerCase())
        const isGlobal = currentAgents.includes('*')

        if (isOurAgent || isGlobal) {
          const delay = parseFloat(value)
          if (!isNaN(delay) && delay > 0) {
            rules.crawlDelay = delay
          }
        }
      }
    }

    return rules
  }

  /**
   * Check if path matches any of the rules.
   * Simple prefix matching (not full glob support).
   */
  private matchesAnyRule(path: string, rules: string[]): boolean {
    for (const rule of rules) {
      // Handle * wildcard at end
      if (rule === '*' || rule === '/') {
        // Disallow: * or Disallow: / blocks everything
        if (rule === '*') return true
        // Disallow: / also blocks everything
        if (rule === '/') return true
      }

      // Simple prefix match
      if (rule.endsWith('*')) {
        const prefix = rule.slice(0, -1)
        if (path.startsWith(prefix)) return true
      } else {
        if (path.startsWith(rule)) return true
      }
    }

    return false
  }

  /**
   * Clear the cache (for testing).
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
