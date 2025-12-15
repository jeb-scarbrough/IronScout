/**
 * Product Image Fallback System
 *
 * Tiered approach for product images:
 * 1. Vendor-provided imageUrl (best quality)
 * 2. Brand-specific stock images for major manufacturers
 * 3. Caliber-category placeholder images as final fallback
 *
 * For now, we use programmatic SVG placeholders based on caliber category.
 * Later, these can be replaced with actual stock photos.
 */

// Major ammo brands - can be expanded with actual stock images later
const BRAND_IMAGE_MAP: Record<string, string> = {
  // These would be paths to actual brand images when available
  // 'federal': '/images/brands/federal.jpg',
  // 'hornady': '/images/brands/hornady.jpg',
  // 'winchester': '/images/brands/winchester.jpg',
  // 'remington': '/images/brands/remington.jpg',
  // 'speer': '/images/brands/speer.jpg',
  // 'cci': '/images/brands/cci.jpg',
  // 'fiocchi': '/images/brands/fiocchi.jpg',
  // 'pmc': '/images/brands/pmc.jpg',
}

// Caliber to category mapping for fallback images
type CaliberCategory = 'pistol' | 'rifle' | 'shotgun' | 'rimfire' | 'unknown'

const CALIBER_CATEGORY_MAP: Record<string, CaliberCategory> = {
  // Pistol calibers
  '9mm': 'pistol',
  '9mm luger': 'pistol',
  '9x19': 'pistol',
  '.45 acp': 'pistol',
  '45 acp': 'pistol',
  '.45acp': 'pistol',
  '.40 s&w': 'pistol',
  '40 s&w': 'pistol',
  '.40s&w': 'pistol',
  '.380 acp': 'pistol',
  '380 acp': 'pistol',
  '.380': 'pistol',
  '10mm': 'pistol',
  '10mm auto': 'pistol',
  '.357 magnum': 'pistol',
  '357 magnum': 'pistol',
  '.357 mag': 'pistol',
  '.38 special': 'pistol',
  '38 special': 'pistol',
  '.38 spl': 'pistol',
  '.44 magnum': 'pistol',
  '44 magnum': 'pistol',
  '.44 mag': 'pistol',
  '.32 acp': 'pistol',
  '.25 acp': 'pistol',

  // Rifle calibers
  '5.56': 'rifle',
  '5.56x45': 'rifle',
  '5.56 nato': 'rifle',
  '.223': 'rifle',
  '.223 rem': 'rifle',
  '223 remington': 'rifle',
  '.308': 'rifle',
  '.308 win': 'rifle',
  '308 winchester': 'rifle',
  '7.62x51': 'rifle',
  '7.62 nato': 'rifle',
  '7.62x39': 'rifle',
  '.300 blackout': 'rifle',
  '300 blk': 'rifle',
  '.300 blk': 'rifle',
  '300 blackout': 'rifle',
  '.30-06': 'rifle',
  '30-06': 'rifle',
  '.30-30': 'rifle',
  '30-30': 'rifle',
  '.243': 'rifle',
  '.270': 'rifle',
  '6.5 creedmoor': 'rifle',
  '6.5mm creedmoor': 'rifle',
  '.350 legend': 'rifle',
  '.450 bushmaster': 'rifle',

  // Shotgun
  '12 gauge': 'shotgun',
  '12ga': 'shotgun',
  '12 ga': 'shotgun',
  '20 gauge': 'shotgun',
  '20ga': 'shotgun',
  '20 ga': 'shotgun',
  '.410': 'shotgun',
  '410 bore': 'shotgun',
  '16 gauge': 'shotgun',

  // Rimfire
  '.22 lr': 'rimfire',
  '22 lr': 'rimfire',
  '.22lr': 'rimfire',
  '22lr': 'rimfire',
  '.22 long rifle': 'rimfire',
  '.17 hmr': 'rimfire',
  '17 hmr': 'rimfire',
  '.22 wmr': 'rimfire',
  '22 wmr': 'rimfire',
  '.22 magnum': 'rimfire',
}

// Color schemes for each category
const CATEGORY_COLORS: Record<CaliberCategory, { bg: string; accent: string; text: string }> = {
  pistol: { bg: '#1e3a5f', accent: '#f59e0b', text: '#ffffff' },
  rifle: { bg: '#1e3f1e', accent: '#84cc16', text: '#ffffff' },
  shotgun: { bg: '#4a1e1e', accent: '#ef4444', text: '#ffffff' },
  rimfire: { bg: '#3b3b5c', accent: '#8b5cf6', text: '#ffffff' },
  unknown: { bg: '#374151', accent: '#6b7280', text: '#ffffff' },
}

// Category labels for display
const CATEGORY_LABELS: Record<CaliberCategory, string> = {
  pistol: 'PISTOL',
  rifle: 'RIFLE',
  shotgun: 'SHOTGUN',
  rimfire: 'RIMFIRE',
  unknown: 'AMMO',
}

/**
 * Get caliber category from caliber string
 */
export function getCaliberCategory(caliber?: string | null): CaliberCategory {
  if (!caliber) return 'unknown'

  const normalized = caliber.toLowerCase().trim()

  // Direct match
  if (CALIBER_CATEGORY_MAP[normalized]) {
    return CALIBER_CATEGORY_MAP[normalized]
  }

  // Partial match
  for (const [key, category] of Object.entries(CALIBER_CATEGORY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return category
    }
  }

  return 'unknown'
}

/**
 * Generate a data URI for a placeholder SVG
 * This creates a visually appealing placeholder with caliber info
 */
export function generatePlaceholderSvg(
  caliber?: string | null,
  brand?: string | null
): string {
  const category = getCaliberCategory(caliber)
  const colors = CATEGORY_COLORS[category]
  const categoryLabel = CATEGORY_LABELS[category]

  // Escape text for SVG
  const escapeXml = (text: string) =>
    text.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;'
        case '>': return '&gt;'
        case '&': return '&amp;'
        case "'": return '&apos;'
        case '"': return '&quot;'
        default: return c
      }
    })

  const displayCaliber = caliber ? escapeXml(caliber.toUpperCase()) : ''
  const displayBrand = brand ? escapeXml(brand.toUpperCase()) : ''

  // Truncate long text
  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen - 2) + '..' : text

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.bg};stop-opacity:0.85" />
    </linearGradient>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${colors.accent}" stroke-width="0.5" opacity="0.1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="200" height="200" fill="url(#bg)"/>
  <rect width="200" height="200" fill="url(#grid)"/>

  <!-- Decorative bullet silhouette -->
  <g transform="translate(100, 85)" opacity="0.15">
    <ellipse cx="0" cy="0" rx="25" ry="40" fill="${colors.text}"/>
    <rect x="-25" y="0" width="50" height="30" fill="${colors.text}"/>
  </g>

  <!-- Category badge -->
  <rect x="10" y="10" width="60" height="20" rx="3" fill="${colors.accent}"/>
  <text x="40" y="24" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="${colors.bg}" text-anchor="middle">${categoryLabel}</text>

  <!-- Caliber text -->
  ${displayCaliber ? `<text x="100" y="130" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="${colors.text}" text-anchor="middle">${truncate(displayCaliber, 12)}</text>` : ''}

  <!-- Brand text -->
  ${displayBrand ? `<text x="100" y="155" font-family="system-ui, sans-serif" font-size="12" fill="${colors.accent}" text-anchor="middle">${truncate(displayBrand, 20)}</text>` : ''}

  <!-- IronScout watermark -->
  <text x="100" y="188" font-family="system-ui, sans-serif" font-size="8" fill="${colors.text}" text-anchor="middle" opacity="0.5">IronScout.ai</text>
</svg>`.trim()

  // Convert to data URI
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Get the best available image URL for a product
 *
 * Priority:
 * 1. Vendor-provided imageUrl
 * 2. Brand-specific stock image (when available)
 * 3. Generated placeholder SVG based on caliber
 */
export function getProductImageUrl(
  imageUrl?: string | null,
  caliber?: string | null,
  brand?: string | null
): string {
  // Tier 1: Use vendor image if available and valid
  if (imageUrl && imageUrl.trim() !== '') {
    return imageUrl
  }

  // Tier 2: Check for brand-specific stock image
  if (brand) {
    const brandKey = brand.toLowerCase().trim()
    if (BRAND_IMAGE_MAP[brandKey]) {
      return BRAND_IMAGE_MAP[brandKey]
    }
  }

  // Tier 3: Generate placeholder SVG
  return generatePlaceholderSvg(caliber, brand)
}

/**
 * Check if an image URL is a placeholder (not a real product image)
 */
export function isPlaceholderImage(url: string): boolean {
  return url.startsWith('data:image/svg+xml') || url.includes('placeholder')
}
