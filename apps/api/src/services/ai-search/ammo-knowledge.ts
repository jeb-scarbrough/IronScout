/**
 * Domain knowledge for ammunition
 * Used by the AI intent parser to understand user queries
 */

import { CALIBER_ALIASES as DB_CALIBER_ALIASES } from '@ironscout/db/calibers'

// Common platform-to-caliber mappings
export const PLATFORM_CALIBER_MAP: Record<string, string[]> = {
  // Rifles
  'ar15': ['.223 Remington', '5.56 NATO'],
  'ar-15': ['.223 Remington', '5.56 NATO'],
  'ar10': ['.308 Winchester', '7.62 NATO'],
  'ar-10': ['.308 Winchester', '7.62 NATO'],
  'ak47': ['7.62x39mm'],
  'ak-47': ['7.62x39mm'],
  'ak74': ['5.45x39mm'],
  'ak-74': ['5.45x39mm'],
  'mini-14': ['.223 Remington', '5.56 NATO'],
  'sks': ['7.62x39mm'],
  'm1 garand': ['.30-06 Springfield'],
  'm1a': ['.308 Winchester', '7.62 NATO'],
  'mosin nagant': ['7.62x54R'],
  
  // Handguns
  'glock 19': ['9mm Luger'],
  'glock 17': ['9mm Luger'],
  'glock 43': ['9mm Luger'],
  '1911': ['.45 ACP'],
  'beretta 92': ['9mm Luger'],
  'sig p365': ['9mm Luger'],
  'sig p320': ['9mm Luger'],
  'smith & wesson shield': ['9mm Luger', '.40 S&W'],
  'revolver': ['.38 Special', '.357 Magnum', '.44 Magnum'],
  
  // Shotguns
  'shotgun': ['12 Gauge', '20 Gauge'],
  'mossberg 500': ['12 Gauge', '20 Gauge'],
  'remington 870': ['12 Gauge', '20 Gauge'],
  'benelli m4': ['12 Gauge'],
}

// Purpose/use-case mappings with synonyms
export const PURPOSE_SYNONYMS: Record<string, string> = {
  // Target/Practice
  'target': 'Target',
  'practice': 'Target',
  'training': 'Target',
  'range': 'Target',
  'plinking': 'Target',
  'recreational': 'Target',
  'competition': 'Target',
  'match': 'Target',
  
  // Defense
  'defense': 'Defense',
  'self-defense': 'Defense',
  'self defense': 'Defense',
  'home defense': 'Defense',
  'protection': 'Defense',
  'carry': 'Defense',
  'ccw': 'Defense',
  'edc': 'Defense',
  'tactical': 'Defense',
  
  // Hunting
  'hunting': 'Hunting',
  'hunt': 'Hunting',
  'deer': 'Hunting',
  'elk': 'Hunting',
  'varmint': 'Hunting',
  'hog': 'Hunting',
  'predator': 'Hunting',
  'game': 'Hunting',
}

// Caliber aliases derived from the authoritative DB source (packages/db/calibers.ts).
// Canonical name is placed first in each variations array so intent.calibers[0]
// works correctly for grain weight lookup in CALIBER_GRAIN_RANGES.
export const CALIBER_ALIASES: Record<string, string[]> = {}
for (const [canonical, aliases] of Object.entries(DB_CALIBER_ALIASES)) {
  if (canonical === 'Other') continue
  const variations = [canonical, ...aliases]
  for (const alias of aliases) {
    CALIBER_ALIASES[alias] = variations
  }
}

// Bare-prefix aliases commonly used in search queries but not in the DB's
// authoritative list (which is tuned for exact DB matching, not fuzzy user input).
const SHORT_FORM_CALIBERS: Record<string, string> = {
  '.22': '.22 LR',
  '.25': '.25 ACP',
  '.32': '.32 ACP',
  '.38': '.38 Special',
  '.40': '.40 S&W',
  '.45': '.45 ACP',
  '.223': '.223/5.56',
  '.243': '.243 Winchester',
  '.270': '.270 Winchester',
  '.308': '.308/7.62x51',
  '.380': '.380 ACP',
  '7.62': '.308/7.62x51',
}
for (const [short, canonical] of Object.entries(SHORT_FORM_CALIBERS)) {
  if (!CALIBER_ALIASES[short]) {
    const dbAliases = DB_CALIBER_ALIASES[canonical as keyof typeof DB_CALIBER_ALIASES]
    if (dbAliases) {
      CALIBER_ALIASES[short] = [canonical, ...dbAliases]
    }
  }
}

// Bare-number caliber fallback — maps bare digits (without dots) to canonical calibers.
// Used when no alias matches: "38 range" → [.38 Special, .380 ACP]
export const BARE_NUMBER_CALIBERS: Record<string, string[]> = {
  '22':  ['.22 LR', '.22 WMR'],
  '17':  ['.17 HMR'],
  '25':  ['.25 ACP'],
  '32':  ['.32 ACP'],
  '38':  ['.38 Special', '.380 ACP'],
  '40':  ['.40 S&W'],
  '45':  ['.45 ACP', '.45 Colt'],
  '223': ['.223/5.56'],
  '243': ['.243 Winchester'],
  '270': ['.270 Winchester'],
  '308': ['.308/7.62x51'],
  '357': ['.357 Magnum'],
  '380': ['.380 ACP'],
  '410': ['.410 Bore'],
}

// Range preferences - maps to grain weight recommendations
export const RANGE_GRAIN_PREFERENCES: Record<string, { weight: 'light' | 'medium' | 'heavy', reason: string }> = {
  'long range': { weight: 'heavy', reason: 'Heavier bullets maintain velocity and resist wind better at distance' },
  'long-range': { weight: 'heavy', reason: 'Heavier bullets maintain velocity and resist wind better at distance' },
  'distance': { weight: 'heavy', reason: 'Heavier bullets maintain velocity and resist wind better at distance' },
  'precision': { weight: 'heavy', reason: 'Heavier match-grade bullets offer better accuracy' },
  'short range': { weight: 'light', reason: 'Lighter bullets have faster velocity for close targets' },
  'close range': { weight: 'light', reason: 'Lighter bullets have faster velocity for close targets' },
  'cqb': { weight: 'light', reason: 'Lighter bullets for faster target acquisition' },
}

// Grain weight ranges by caliber
export const CALIBER_GRAIN_RANGES: Record<string, { light: number[], medium: number[], heavy: number[] }> = {
  '9mm': { light: [115], medium: [124], heavy: [147] },
  '.223/5.56': { light: [55], medium: [62, 64], heavy: [69, 77] },
  '.308/7.62': { light: [147, 150], medium: [165, 168], heavy: [175, 180] },
  '.45 ACP': { light: [185], medium: [200], heavy: [230] },
  '.40 S&W': { light: [155], medium: [165], heavy: [180] },
}

// Quality indicators in product names
export const QUALITY_INDICATORS = {
  matchGrade: ['match', 'sierra', 'matchking', 'smk', 'gold medal', 'berger', 'lapua', 'hornady match', 'eld-m', 'nosler', 'bthp'],
  budget: ['steel case', 'steel-case', 'wolf', 'tula', 'barnaul', 'brown bear', 'cheap', 'budget', 'affordable', 'value'],
  premium: ['brass', 'nickel', 'federal premium', 'hornady', 'speer gold dot', 'barnes', 'best', 'quality', 'premium'],
}

// Common ammunition brands for quick parse
export const AMMO_BRANDS: string[] = [
  'federal', 'hornady', 'winchester', 'remington', 'speer', 'cci', 'pmc', 'fiocchi',
  'sig sauer', 'sig', 'blazer', 'american eagle', 'magtech', 'sellier & bellot', 's&b',
  'aguila', 'norma', 'prvi partizan', 'ppu', 'wolf', 'tula', 'barnaul', 'brown bear',
  'barnes', 'nosler', 'berger', 'lapua', 'sierra', 'gold dot', 'hst', 'critical defense',
  'critical duty', 'v-max', 'eld-x', 'eld-m', 'sst', 'gmx', 'ttsx', 'tsx'
]

// Bullet type keywords for quick parse
export const BULLET_TYPE_KEYWORDS: Record<string, string> = {
  // Hollow points (defense)
  'jhp': 'JHP',
  'hollow point': 'JHP',
  'hollowpoint': 'JHP',
  'hp': 'HP',
  'hst': 'HST',
  'gold dot': 'GDHP',
  'critical defense': 'FTX',
  'critical duty': 'FTX',
  'v-crown': 'JHP',

  // FMJ (target)
  'fmj': 'FMJ',
  'full metal jacket': 'FMJ',
  'ball': 'FMJ',
  'tmj': 'TMJ',
  'total metal jacket': 'TMJ',

  // Soft point (hunting)
  'soft point': 'SP',
  'sp': 'SP',
  'jsp': 'JSP',

  // Match/precision
  'bthp': 'BTHP',
  'match': 'BTHP',
  'smk': 'BTHP',
  'matchking': 'BTHP',
  'eld-m': 'BTHP',

  // Specialty
  'frangible': 'FRANGIBLE',
  'tracer': 'TRACER',
  'subsonic': 'SUBSONIC',
}

// Case material preferences by use
export const CASE_MATERIAL_BY_PURPOSE: Record<string, string[]> = {
  'Target': ['Brass', 'Steel'], // Steel OK for practice
  'Defense': ['Brass', 'Nickel'], // Reliability matters
  'Hunting': ['Brass'], // Quality matters
  'competition': ['Brass', 'Nickel'], // Consistency matters
}

/**
 * Get recommended grain weights for a caliber and purpose
 */
export function getRecommendedGrains(caliber: string, purpose: string, range?: string): number[] {
  const normalizedCaliber = Object.keys(CALIBER_GRAIN_RANGES).find(c => 
    caliber.toLowerCase().includes(c.toLowerCase()) ||
    c.toLowerCase().includes(caliber.toLowerCase())
  )
  
  if (!normalizedCaliber) return []
  
  const ranges = CALIBER_GRAIN_RANGES[normalizedCaliber]
  if (!ranges) return []
  
  // If long range specified, prefer heavy
  if (range && RANGE_GRAIN_PREFERENCES[range.toLowerCase()]?.weight === 'heavy') {
    return ranges.heavy
  }
  
  // By purpose
  switch (purpose) {
    case 'Defense':
      return [...ranges.medium, ...ranges.heavy] // JHP typically in medium-heavy
    case 'Hunting':
      return [...ranges.medium, ...ranges.heavy]
    case 'Target':
    default:
      return [...ranges.light, ...ranges.medium] // FMJ typically lighter, but match can be heavy
  }
}

/**
 * Extract caliber from platform mention
 */
export function getCalibrFromPlatform(platform: string): string[] {
  const normalized = platform.toLowerCase().trim()
  return PLATFORM_CALIBER_MAP[normalized] || []
}

/**
 * Normalize purpose from synonyms
 */
export function normalizePurpose(input: string): string | null {
  const normalized = input.toLowerCase().trim()
  return PURPOSE_SYNONYMS[normalized] || null
}

/**
 * Get all possible caliber variations
 */
export function getCaliberVariations(caliber: string): string[] {
  const normalized = caliber.toLowerCase().trim()
  return CALIBER_ALIASES[normalized] || [caliber]
}
