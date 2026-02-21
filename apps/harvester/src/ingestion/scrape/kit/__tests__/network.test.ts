import { describe, expect, it } from 'vitest'
import { isPrivateOrReservedHost } from '../network.js'
import { validateBaseUrls } from '../normalize.js'

describe('isPrivateOrReservedHost', () => {
  it('blocks RFC1918, link-local, CGNAT, and localhost hosts', () => {
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '100.127.255.255',
    ]

    for (const host of blockedHosts) {
      expect(isPrivateOrReservedHost(host)).toBe(true)
    }
  })

  it('blocks loopback, unique-local, link-local, and mapped IPv6 hosts', () => {
    const blockedHosts = ['::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1']

    for (const host of blockedHosts) {
      expect(isPrivateOrReservedHost(host)).toBe(true)
    }
  })

  it('allows public hosts', () => {
    const publicHosts = ['example.com', '172.32.0.1', '100.128.0.1', '2606:4700::1111']

    for (const host of publicHosts) {
      expect(isPrivateOrReservedHost(host)).toBe(false)
    }
  })
})

describe('validateBaseUrls', () => {
  it('rejects manifests with blocked private ranges', () => {
    const result = validateBaseUrls({
      id: 'x',
      name: 'X',
      owner: 'harvester',
      version: '1.0.0',
      mode: 'html',
      baseUrls: ['https://172.20.10.5'],
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('blocked')
  })
})
