/**
 * Pulse Endpoint — Per-Caliber Cap Guardrails & Regression Tests
 *
 * These tests enforce that:
 * 1. The products query uses SQL-level ROW_NUMBER() partitioning (not JS-only capping)
 * 2. The historical prices query uses SQL-level LIMIT via Prisma take (not JS-only capping)
 * 3. Sparse calibers are not starved by dense calibers
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const DASHBOARD_PATH = path.resolve(__dirname, '../dashboard.ts').replace(/\\/g, '/')

describe('Pulse Caliber Caps — Guardrails', () => {
  let dashboardSource: string

  beforeAll(() => {
    dashboardSource = fs.readFileSync(DASHBOARD_PATH, 'utf-8')
  })

  /**
   * CRITICAL: Products query must use ROW_NUMBER() OVER (PARTITION BY caliber)
   * to cap at 100 per caliber in SQL, not fetch all and cap in JS.
   */
  it('products_query_uses_sql_level_row_number_cap', () => {
    expect(dashboardSource).toMatch(/ROW_NUMBER\(\)\s+OVER\s*\(\s*PARTITION\s+BY\s+caliber/)
  })

  /**
   * CRITICAL: Historical prices query must use Prisma `take:` to enforce
   * SQL-level LIMIT per caliber, not fetch all and cap in JS.
   */
  it('historical_prices_query_uses_take_limit', () => {
    // The per-caliber historical prices query must use take: to enforce LIMIT
    expect(dashboardSource).toMatch(/take:\s*MAX_HISTORICAL_PER_CALIBER/)
  })

  /**
   * Both constants must be defined and used for the caps.
   */
  it('cap_constants_are_defined', () => {
    expect(dashboardSource).toContain('MAX_PRODUCTS_PER_CALIBER = 100')
    expect(dashboardSource).toContain('MAX_HISTORICAL_PER_CALIBER = 50')
  })

  /**
   * Historical prices must be queried per-caliber (via sourceProductIdsByCaliber),
   * not as a single unbounded batch across all calibers.
   */
  it('historical_prices_are_queried_per_caliber', () => {
    expect(dashboardSource).toContain('sourceProductIdsByCaliber')
    // Must NOT contain the old unbounded pattern
    expect(dashboardSource).not.toMatch(/allSourceProductIds\s*=\s*allLinks\.map/)
  })
})
