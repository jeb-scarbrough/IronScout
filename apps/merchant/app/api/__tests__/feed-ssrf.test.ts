/**
 * Feed SSRF validation tests (#172)
 *
 * Verify that feed URL creation and update routes reject URLs
 * that target internal networks, cloud metadata, or localhost.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { validateUrlForSSRF } from '@/lib/ssrf-guard'

// Mock DNS resolution to avoid real network calls in tests
vi.mock('dns', () => ({
  promises: {
    resolve4: vi.fn().mockRejectedValue(new Error('mock: no A records')),
    resolve6: vi.fn().mockRejectedValue(new Error('mock: no AAAA records')),
  },
}))

describe('SSRF guard rejects dangerous feed URLs', () => {
  describe('Cloud metadata endpoints', () => {
    it('should block AWS metadata endpoint', async () => {
      const result = await validateUrlForSSRF('http://169.254.169.254/latest/meta-data/', { skipDNSResolution: true })
      expect(result.safe).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('should block GCP metadata endpoint', async () => {
      const result = await validateUrlForSSRF('http://metadata.google.internal/computeMetadata/v1/', { skipDNSResolution: true })
      expect(result.safe).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('should block AWS ECS task metadata', async () => {
      const result = await validateUrlForSSRF('http://169.254.170.2/v2/metadata', { skipDNSResolution: true })
      expect(result.safe).toBe(false)
      expect(result.error).toContain('not allowed')
    })
  })

  describe('Private IP ranges (RFC 1918)', () => {
    it('should block 10.x.x.x range', async () => {
      const result = await validateUrlForSSRF('http://10.0.0.1/feed.csv')
      expect(result.safe).toBe(false)
    })

    it('should block 172.16-31.x.x range', async () => {
      const result = await validateUrlForSSRF('http://172.16.0.1/feed.csv')
      expect(result.safe).toBe(false)
    })

    it('should block 192.168.x.x range', async () => {
      const result = await validateUrlForSSRF('http://192.168.1.1/feed.csv')
      expect(result.safe).toBe(false)
    })
  })

  describe('Localhost', () => {
    it('should block localhost', async () => {
      const result = await validateUrlForSSRF('http://localhost/feed.csv', { skipDNSResolution: true })
      expect(result.safe).toBe(false)
      expect(result.error).toContain('Localhost')
    })

    it('should block 127.0.0.1', async () => {
      const result = await validateUrlForSSRF('http://127.0.0.1/feed.csv')
      expect(result.safe).toBe(false)
    })

    it('should block 127.x.x.x range', async () => {
      const result = await validateUrlForSSRF('http://127.0.0.2:5432/')
      expect(result.safe).toBe(false)
    })
  })

  describe('Loopback and link-local', () => {
    it('should block 0.0.0.0', async () => {
      const result = await validateUrlForSSRF('http://0.0.0.0/feed.csv')
      expect(result.safe).toBe(false)
    })

    it('should block link-local 169.254.x.x range', async () => {
      const result = await validateUrlForSSRF('http://169.254.1.1/feed.csv')
      expect(result.safe).toBe(false)
    })
  })

  describe('Protocol restrictions', () => {
    it('should block file:// protocol', async () => {
      const result = await validateUrlForSSRF('file:///etc/passwd')
      expect(result.safe).toBe(false)
      expect(result.error).toContain('Protocol')
    })

    it('should block javascript: protocol', async () => {
      const result = await validateUrlForSSRF('javascript:alert(1)')
      // new URL() may throw for this, which is also safe
      expect(result.safe).toBe(false)
    })

    it('should allow FTP when explicitly permitted', async () => {
      const result = await validateUrlForSSRF('ftp://feeds.example.com/feed.csv', { allowFTP: true, skipDNSResolution: true })
      expect(result.safe).toBe(true)
    })

    it('should block FTP by default', async () => {
      const result = await validateUrlForSSRF('ftp://feeds.example.com/feed.csv', { skipDNSResolution: true })
      expect(result.safe).toBe(false)
    })
  })

  describe('Valid external URLs', () => {
    it('should allow valid HTTPS URL', async () => {
      const result = await validateUrlForSSRF('https://feeds.example.com/feed.csv', { skipDNSResolution: true })
      expect(result.safe).toBe(true)
    })

    it('should allow valid HTTP URL', async () => {
      const result = await validateUrlForSSRF('http://feeds.example.com/feed.csv', { skipDNSResolution: true })
      expect(result.safe).toBe(true)
    })
  })

  describe('URL with credentials', () => {
    it('should block HTTP URLs with embedded credentials', async () => {
      const result = await validateUrlForSSRF('http://user:pass@feeds.example.com/feed.csv', { skipDNSResolution: true })
      expect(result.safe).toBe(false)
      expect(result.error).toContain('credentials')
    })

    it('should allow FTP URLs with credentials when FTP is allowed', async () => {
      const result = await validateUrlForSSRF('ftp://user:pass@feeds.example.com/feed.csv', { allowFTP: true, skipDNSResolution: true })
      expect(result.safe).toBe(true)
    })
  })
})
