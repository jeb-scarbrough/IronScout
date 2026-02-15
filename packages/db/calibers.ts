/**
 * Shared Caliber Constants and Utilities (ADR-025)
 *
 * Single source of truth for canonical calibers, aliases, and slug mappings.
 * Used by: API (gun-locker, price-check), Harvester (caliber snapshots), WWW (caliber pages).
 */

/**
 * Canonical caliber values per gun_locker_v1_spec.md
 * These are the only valid caliber values that can be stored.
 */
export const CANONICAL_CALIBERS = [
  '9mm',
  '.38 Special',
  '.357 Magnum',
  '.25 ACP',
  '.32 ACP',
  '10mm Auto',
  '.45 ACP',
  '.45 Colt',
  '.40 S&W',
  '.380 ACP',
  '.22 LR',
  '.22 WMR',
  '.17 HMR',
  '.223/5.56',
  '.308/7.62x51',
  '.30-06',
  '.300 AAC Blackout',
  '6.5 Creedmoor',
  '7.62x39',
  '.243 Winchester',
  '.270 Winchester',
  '.30-30 Winchester',
  '12ga',
  '20ga',
  '16ga',
  '.410 Bore',
  'Other',
] as const

export type CaliberValue = typeof CANONICAL_CALIBERS[number]

/**
 * Lowercased alias groups for each canonical caliber.
 * Used for database matching with LOWER(p.caliber) = ANY(aliases).
 */
export const CALIBER_ALIASES: Record<CaliberValue, string[]> = {
  '9mm': ['9mm', '9mm luger', '9mm parabellum', '9x19', '9x19mm'],
  '.38 Special': ['.38 special', '38 special', '.38 spl', '38 spl'],
  '.357 Magnum': ['.357 magnum', '357 magnum', '.357 mag', '357 mag'],
  '.25 ACP': ['.25 acp', '25 acp', '.25 auto'],
  '.32 ACP': ['.32 acp', '32 acp', '.32 auto', '7.65mm'],
  '10mm Auto': ['10mm', '10mm auto'],
  '.45 ACP': ['.45 acp', '45 acp', '.45acp', '.45 auto'],
  '.45 Colt': ['.45 colt', '45 colt', '.45 long colt', '45 lc'],
  '.40 S&W': ['.40 s&w', '40 s&w', '.40sw', '.40 smith & wesson'],
  '.380 ACP': ['.380 acp', '380 acp', '.380acp', '.380 auto'],
  '.22 LR': ['.22 lr', '22 lr', '.22lr', '22lr', '.22 long rifle'],
  '.22 WMR': ['.22 wmr', '22 wmr', '.22 magnum', '22 magnum', '.22 mag'],
  '.17 HMR': ['.17 hmr', '17 hmr', '.17 hornady magnum'],
  '.223/5.56': ['.223 rem', '.223 remington', '223 rem', '5.56', '5.56mm', '5.56x45', '5.56 nato', '.223/5.56'],
  '.308/7.62x51': ['.308 win', '.308 winchester', '308 win', '7.62x51', '7.62x51mm', '7.62 nato', '.308/7.62x51'],
  '.30-06': ['.30-06', '30-06', '.30-06 springfield', '.30-06 sprg'],
  '.300 AAC Blackout': ['.300 blackout', '300 blackout', '.300 aac', '300 aac', '.300 blk', '300 blk'],
  '6.5 Creedmoor': ['6.5 creedmoor', '6.5mm creedmoor', '6.5 cm'],
  '7.62x39': ['7.62x39', '7.62x39mm'],
  '.243 Winchester': ['.243 win', '.243 winchester', '243 win'],
  '.270 Winchester': ['.270 win', '.270 winchester', '270 win'],
  '.30-30 Winchester': ['.30-30', '30-30', '.30-30 win', '30-30 winchester'],
  '12ga': ['12 gauge', '12 ga', '12ga', '12g'],
  '20ga': ['20 gauge', '20 ga', '20ga', '20g'],
  '16ga': ['16 gauge', '16 ga', '16ga', '16g'],
  '.410 Bore': ['.410', '410', '.410 bore', '410 bore'],
  'Other': ['other'],
}

/**
 * Get lowercased caliber aliases for database matching.
 * Used in SQL: LOWER(p.caliber) = ANY($1::text[])
 */
export function getCaliberAliases(caliber: CaliberValue): string[] {
  const aliases = CALIBER_ALIASES[caliber]
  if (!aliases) return [caliber.toLowerCase()]
  return aliases.map(a => a.toLowerCase())
}

/**
 * URL slug to CaliberValue mapping for www caliber pages.
 * Maps slugs from apps/www/content/calibers/ to canonical values.
 */
export const CALIBER_SLUG_MAP: Record<string, CaliberValue> = {
  '9mm': '9mm',
  '556-nato': '.223/5.56',
  '308-winchester': '.308/7.62x51',
  '22-lr': '.22 LR',
  '45-acp': '.45 ACP',
  '300-blackout': '.300 AAC Blackout',
  '30-06-springfield': '.30-06',
  '65-creedmoor': '6.5 Creedmoor',
  '223-remington': '.223/5.56',
  '762x39': '7.62x39',
  '380-acp': '.380 ACP',
  '40-sw': '.40 S&W',
  '10mm-auto': '10mm Auto',
  '12-gauge': '12ga',
}
