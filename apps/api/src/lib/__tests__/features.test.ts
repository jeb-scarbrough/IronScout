import { describe, it, expect, vi, afterEach } from 'vitest'
import { logFeatureStatus } from '../features'

describe('Features logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs v1 full-capabilities message', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    logFeatureStatus()

    expect(logSpy).toHaveBeenCalledWith(
      '[Features] V1 mode: All users receive full capabilities'
    )
  })
})
