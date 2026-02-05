import { describe, it, expect, vi, afterEach } from 'vitest'
import { logFeatureStatus } from '../features'
import { loggers } from '../../config/logger'

describe('Features logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs v1 full-capabilities message', () => {
    const infoSpy = vi.spyOn(loggers.server, 'info').mockImplementation(() => undefined as any)

    logFeatureStatus()

    expect(infoSpy).toHaveBeenCalledWith(
      'V1 mode: All users receive full capabilities'
    )
  })
})
