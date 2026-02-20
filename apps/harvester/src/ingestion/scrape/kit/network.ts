function parseIpv4Octets(hostname: string): number[] | null {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null
  }
  const octets = hostname.split('.').map(part => Number.parseInt(part, 10))
  if (octets.length !== 4 || octets.some(value => Number.isNaN(value) || value < 0 || value > 255)) {
    return null
  }
  return octets
}

function isBlockedIpv4(hostname: string): boolean {
  const octets = parseIpv4Octets(hostname)
  if (!octets) {
    return false
  }

  const [a, b] = octets
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isBlockedIpv6(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (host === '::' || host === '::1') {
    return true
  }

  if (host.startsWith('::ffff:')) {
    const mappedIpv4 = host.slice('::ffff:'.length)
    return isBlockedIpv4(mappedIpv4)
  }

  const firstHextetText = host.split(':')[0]
  if (!firstHextetText) {
    return false
  }

  const firstHextet = Number.parseInt(firstHextetText, 16)
  if (!Number.isFinite(firstHextet)) {
    return false
  }

  // fc00::/7 unique local addresses
  if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) {
    return true
  }

  // fe80::/10 link-local addresses
  if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) {
    return true
  }

  return false
}

export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host) {
    return true
  }

  if (host === 'localhost') {
    return true
  }

  if (isBlockedIpv4(host)) {
    return true
  }

  if (host.includes(':') && isBlockedIpv6(host)) {
    return true
  }

  return false
}
