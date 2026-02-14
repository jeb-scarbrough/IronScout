export declare const CANONICAL_CALIBERS: readonly [
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
]

export type CaliberValue = typeof CANONICAL_CALIBERS[number]

export declare const CALIBER_ALIASES: Record<CaliberValue, string[]>

export declare function getCaliberAliases(caliber: CaliberValue): string[]

export declare const CALIBER_SLUG_MAP: Record<string, CaliberValue>
