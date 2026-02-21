/// <reference types="vitest/globals" />

import { readFileSync } from 'node:fs'

describe('dashboard auth token regressions', () => {
  it('does not pass session user id as alerts bearer token in dashboard stats', () => {
    const source = readFileSync(new URL('../../../hooks/use-dashboard-stats.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('getUserAlerts(session.user.id')
    expect(source).toContain('getUserAlerts(authToken, false)')
    expect(source).toContain('refreshSessionToken()')
  })

  it('does not pass session user id as alerts bearer token in tracked products chart', () => {
    const source = readFileSync(new URL('../../../components/dashboard/tracked-products-charts.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain('getUserAlerts(session.user.id')
    expect(source).toContain('getUserAlerts(authToken, true)')
    expect(source).toContain('refreshSessionToken()')
  })

  it('keeps compare-prices callback tied to current token', () => {
    const source = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')

    const start = source.indexOf('const handleCompareClick = useCallback(')
    const end = source.indexOf('// Handle "Find similar" click - navigate to search with caliber filter')
    const snippet = source.slice(start, end)

    expect(snippet).toContain('[token]')
    expect(snippet).toMatch(/,\s*\[token\]\s*\)/)
  })
})
