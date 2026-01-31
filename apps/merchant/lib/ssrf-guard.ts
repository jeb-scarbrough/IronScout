/**
 * SSRF Guard - Prevents Server-Side Request Forgery attacks
 *
 * Validates URLs before server-side fetching to block:
 * - Private IP ranges (RFC 1918)
 * - Loopback addresses
 * - Link-local addresses
 * - Cloud metadata endpoints
 * - Invalid protocols
 */

import { logger } from './logger'

const log = logger.child({ component: 'ssrf-guard' })

/**
 * Result of URL validation
 */
export interface SSRFValidationResult {
  safe: boolean
  error?: string
  normalizedUrl?: string
}

/**
 * Allowed protocols for HTTP feeds
 */
const ALLOWED_HTTP_PROTOCOLS = ['http:', 'https:']

/**
 * Allowed protocols for FTP feeds
 */
const ALLOWED_FTP_PROTOCOLS = ['ftp:', 'sftp:']

/**
 * Cloud metadata endpoints to block
 */
const BLOCKED_HOSTS = new Set([
  '169.254.169.254', // AWS/GCP/Azure metadata
  'metadata.google.internal', // GCP metadata
  'metadata.goog', // GCP metadata
  '169.254.170.2', // AWS ECS task metadata
  'fd00:ec2::254', // AWS IMDSv2 IPv6
])

/**
 * Check if an IP address is in a private range (RFC 1918)
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    // Not a valid IPv4, check for IPv6
    return isPrivateIPv6(ip)
  }

  const [a, b] = parts

  // 10.0.0.0/8 (Class A private)
  if (a === 10) return true

  // 172.16.0.0/12 (Class B private)
  if (a === 172 && b >= 16 && b <= 31) return true

  // 192.168.0.0/16 (Class C private)
  if (a === 192 && b === 168) return true

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true

  // 169.254.0.0/16 (Link-local)
  if (a === 169 && b === 254) return true

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true

  return false
}

/**
 * Check if an IPv6 address is private/local
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()

  // Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true

  // Link-local (fe80::/10)
  if (normalized.startsWith('fe80:')) return true

  // Unique local (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

  // IPv4-mapped (::ffff:...)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7)
    return isPrivateIP(ipv4Part)
  }

  return false
}

/**
 * Check if a hostname resolves to a private IP
 * This prevents DNS rebinding attacks
 */
async function resolveHostname(hostname: string): Promise<{ ips: string[]; error?: string }> {
  // Check if hostname is already an IP
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return { ips: [hostname] }
  }

  // Check for IPv6 literal (e.g., [::1])
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const ipv6 = hostname.slice(1, -1)
    return { ips: [ipv6] }
  }

  try {
    // Use dynamic import for Node.js DNS module
    const dns = await import('dns').then(m => m.promises)
    const addresses = await dns.resolve(hostname)
    return { ips: addresses }
  } catch (error) {
    // DNS resolution failed
    return { ips: [], error: `DNS resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * Validate a URL for SSRF safety
 */
export async function validateUrlForSSRF(
  urlString: string,
  options: {
    allowFTP?: boolean
    skipDNSResolution?: boolean
  } = {}
): Promise<SSRFValidationResult> {
  const { allowFTP = false, skipDNSResolution = false } = options

  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return { safe: false, error: 'Invalid URL format' }
  }

  // Validate protocol
  const allowedProtocols = allowFTP
    ? [...ALLOWED_HTTP_PROTOCOLS, ...ALLOWED_FTP_PROTOCOLS]
    : ALLOWED_HTTP_PROTOCOLS

  if (!allowedProtocols.includes(url.protocol)) {
    return {
      safe: false,
      error: `Protocol '${url.protocol}' not allowed. Allowed: ${allowedProtocols.join(', ')}`,
    }
  }

  // Block URLs with credentials in userinfo (security risk)
  if (url.username || url.password) {
    // Allow for FTP which commonly uses URL credentials
    if (!allowFTP) {
      return { safe: false, error: 'URL credentials not allowed in HTTP URLs' }
    }
  }

  const hostname = url.hostname.toLowerCase()

  // Check blocked hosts
  if (BLOCKED_HOSTS.has(hostname)) {
    log.warn('SSRF blocked: metadata endpoint', { hostname })
    return { safe: false, error: 'Access to this host is not allowed' }
  }

  // Check for localhost variations
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost')
  ) {
    return { safe: false, error: 'Localhost access not allowed' }
  }

  // Resolve hostname and check if it's a private IP
  if (!skipDNSResolution) {
    const { ips, error: dnsError } = await resolveHostname(hostname)

    if (dnsError) {
      return { safe: false, error: dnsError }
    }

    if (ips.length === 0) {
      return { safe: false, error: 'Hostname does not resolve to any IP address' }
    }

    // Check all resolved IPs
    for (const ip of ips) {
      if (isPrivateIP(ip)) {
        log.warn('SSRF blocked: private IP', { hostname, ip })
        return { safe: false, error: 'Access to private/internal networks not allowed' }
      }

      if (BLOCKED_HOSTS.has(ip)) {
        log.warn('SSRF blocked: blocked IP', { hostname, ip })
        return { safe: false, error: 'Access to this host is not allowed' }
      }
    }
  }

  return { safe: true, normalizedUrl: url.toString() }
}

/**
 * Validate URL and throw if unsafe
 */
export async function assertUrlSafeForSSRF(
  urlString: string,
  options: { allowFTP?: boolean; skipDNSResolution?: boolean } = {}
): Promise<string> {
  const result = await validateUrlForSSRF(urlString, options)

  if (!result.safe) {
    throw new Error(result.error || 'URL validation failed')
  }

  return result.normalizedUrl!
}

export default { validateUrlForSSRF, assertUrlSafeForSSRF }
