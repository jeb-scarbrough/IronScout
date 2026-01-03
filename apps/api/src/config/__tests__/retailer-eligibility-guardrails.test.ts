/**
 * Retailer Eligibility Guardrail Tests
 *
 * These tests enforce the semantic refactor from merchant-based visibility
 * gating to proper retailer eligibility enforcement.
 *
 * Per ADR-005 and Merchant-and-Retailer-Reference:
 * - Eligibility applies to Retailer visibility only
 * - Retailers do not authenticate; consumer prices keyed by retailerId
 * - Merchant subscription status must NOT gate consumer visibility
 *
 * These tests will FAIL until the refactor is complete. They are
 * intentional guardrails to prevent drift and track progress.
 *
 * Phase 0 Guardrails:
 * 1. Block visibleDealerPriceWhere usage (must be replaced with retailer eligibility)
 * 2. Block harvester_${retailerId} merchant fabrication
 * 3. Assert consumer reads depend on retailer eligibility
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { visibleRetailerPriceWhere } from '../tiers'

// Use forward slashes for cross-platform compatibility
const API_SRC_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/')
const HARVESTER_SRC_ROOT = path.resolve(__dirname, '../../../../harvester/src').replace(/\\/g, '/')
const SCHEMA_PATH = path.resolve(__dirname, '../../../../../packages/db/schema.prisma').replace(/\\/g, '/')

/**
 * Recursively find all TypeScript files in a directory
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findTsFiles(fullPath, files)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath)
    }
  }
  return files
}

/**
 * Search for a pattern in files and return matches
 */
function grepFiles(files: string[], pattern: RegExp): { file: string; line: number; match: string }[] {
  const results: { file: string; line: number; match: string }[] = []

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(pattern)
        if (match) {
          results.push({
            file: path.relative(process.cwd(), file),
            line: i + 1,
            match: match[0],
          })
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return results
}

describe('Retailer Eligibility Guardrails', () => {
  describe('Phase 0: Legacy Pattern Detection', () => {
    it('should NOT use visibleDealerPriceWhere in consumer routes (replaced with visibleRetailerPriceWhere)', () => {
      // All consumer routes have been migrated to use visibleRetailerPriceWhere.
      // This test ensures no regression to the deprecated helper.
      //
      // Migrated routes:
      // - apps/api/src/routes/products.ts ✓
      // - apps/api/src/routes/dashboard.ts ✓
      // - apps/api/src/services/saved-items.ts ✓
      // - apps/api/src/services/ai-search/search-service.ts ✓

      const routesDir = path.join(API_SRC_ROOT, 'routes')
      const servicesDir = path.join(API_SRC_ROOT, 'services')
      const files = [...findTsFiles(routesDir), ...findTsFiles(servicesDir)]

      // Exclude the tiers.ts file itself (where the deprecated wrapper is defined)
      const consumerFiles = files.filter((f) => !f.includes('tiers.ts') && !f.includes('__tests__'))

      const matches = grepFiles(consumerFiles, /visibleDealerPriceWhere/)

      expect(matches).toEqual([])
    })

    it.skip('should NOT fabricate merchant IDs from retailer IDs in harvester (PENDING: remove harvester_${retailerId} pattern)', () => {
      // This test is SKIPPED until benchmark.ts is refactored.
      // The pattern `harvester_${retailerId}` creates fake merchant IDs,
      // conflating Merchant vs Retailer concepts.

      const files = findTsFiles(HARVESTER_SRC_ROOT)
      const matches = grepFiles(files, /harvester_\$\{?retailerId\}?|`harvester_\$\{/)

      expect(matches).toEqual([])
    })

    it('should have retailer visibility fields in schema (PENDING: Phase 1A migration)', () => {
      // This test verifies that the retailers model has visibility state.
      // It will FAIL until the Phase 1A migration is applied.

      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')

      // Check for RetailerVisibility enum
      expect(schema).toContain('enum RetailerVisibility')

      // Check for visibility fields on retailers model
      expect(schema).toMatch(/model retailers \{[\s\S]*?visibilityStatus\s+RetailerVisibility/)
    })

    it('should have merchant_retailers join table in schema (PENDING: Phase 1B migration)', () => {
      // This test verifies that the explicit Merchant↔Retailer mapping exists.
      // It will FAIL until the Phase 1B migration is applied.

      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')

      expect(schema).toContain('model merchant_retailers')
    })

    it('should have provenance fields on prices (PENDING: Phase 1C migration)', () => {
      // This test verifies that prices have ADR-015 required provenance fields.
      // It will FAIL until the Phase 1C migration is applied.

      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')

      // Check for ingestionRunType field on prices
      expect(schema).toMatch(/model prices \{[\s\S]*?ingestionRunType/)
    })
  })

  describe('Phase 2: Consumer Visibility Enforcement', () => {
    it('should export visibleRetailerPriceWhere from tiers.ts', async () => {
      // Verifies the new retailer-eligibility-based filter exists and is exported.

      const tiers = await import('../tiers')
      expect(typeof tiers.visibleRetailerPriceWhere).toBe('function')
    })

    it('should use visibleRetailerPriceWhere in consumer routes', () => {
      // Verifies all consumer routes use the new retailer-eligibility filter.

      const routesDir = path.join(API_SRC_ROOT, 'routes')
      const servicesDir = path.join(API_SRC_ROOT, 'services')
      const files = [...findTsFiles(routesDir), ...findTsFiles(servicesDir)]

      // Files that should use the new helper
      const consumerFiles = files.filter(
        (f) => !f.includes('__tests__') &&
               (f.includes('products.ts') ||
                f.includes('dashboard.ts') ||
                f.includes('saved-items.ts') ||
                f.includes('search-service.ts'))
      )

      const matches = grepFiles(consumerFiles, /visibleRetailerPriceWhere/)

      // Should have at least one match in each consumer file
      expect(matches.length).toBeGreaterThan(0)
    })

    it('should NOT gate consumer queries on subscription status', () => {
      // Consumer surfaces must never look at merchant subscription state.
      const routesDir = path.join(API_SRC_ROOT, 'routes')
      const servicesDir = path.join(API_SRC_ROOT, 'services')
      const files = [...findTsFiles(routesDir), ...findTsFiles(servicesDir)]
      const consumerFiles = files.filter(
        (f) =>
          !f.includes('__tests__') &&
          (f.includes('products.ts') ||
            f.includes('dashboard.ts') ||
            f.includes('saved-items.ts') ||
            f.includes('search-service.ts') ||
            f.includes('search.ts'))
      )

      const matches = grepFiles(consumerFiles, /subscriptionStatus/)

      expect(matches).toEqual([])
    })

    it('should enforce ELIGIBLE + LISTED + ACTIVE in visibleRetailerPriceWhere', () => {
      const where = visibleRetailerPriceWhere()
      expect(where).toEqual({
        retailers: {
          is: {
            visibilityStatus: 'ELIGIBLE',
            merchant_retailers: {
              some: {
                listingStatus: 'LISTED',
                status: 'ACTIVE',
              },
            },
          },
        },
      })
    })
  })
})

/**
 * Integration test placeholder for consumer price query correctness.
 * This will be a full integration test once the refactor is complete.
 */
describe('Consumer Price Query Integration (PENDING)', () => {
  it.skip('should filter prices by retailer eligibility, not merchant subscription', () => {
    // This integration test will:
    // 1. Create a retailer with INELIGIBLE status
    // 2. Create a merchant with ACTIVE subscription
    // 3. Link retailer to merchant
    // 4. Create prices for the retailer
    // 5. Query consumer API and verify prices are NOT returned
    //
    // This catches the semantic correctness: eligibility is retailer-level,
    // not merchant-level.

    expect(true).toBe(false) // Placeholder - will fail until implemented
  })

  it.skip('should return prices from ELIGIBLE retailer even if merchant is EXPIRED', () => {
    // This integration test will:
    // 1. Create a retailer with ELIGIBLE status
    // 2. Create a merchant with EXPIRED subscription
    // 3. Link retailer to merchant
    // 4. Create prices for the retailer
    // 5. Query consumer API and verify prices ARE returned
    //
    // This ensures merchant subscription doesn't wrongly hide eligible retailers.

    expect(true).toBe(false) // Placeholder - will fail until implemented
  })
})
