export interface SyntheticSearchProduct {
  id: string
  caliberNorm: string
  purpose: string
  brand: string
  caseMaterial: string
  grainWeight: number
  bulletType: string
  pressureRating: string
  isSubsonic: boolean
  shortBarrelOptimized: boolean
  suppressorSafe: boolean
  lowFlash: boolean
  lowRecoil: boolean
  matchGrade: boolean
  controlledExpansion: boolean
  muzzleVelocityFps: number
  currentPrice: number
  inStock: boolean
}

export const SYNTHETIC_PRODUCTS: SyntheticSearchProduct[] = [
  {
    id: 'p1-9mm-target-federal',
    caliberNorm: '9mm',
    purpose: 'Target',
    brand: 'Federal',
    caseMaterial: 'Brass',
    grainWeight: 115,
    bulletType: 'FMJ',
    pressureRating: 'STANDARD',
    isSubsonic: false,
    shortBarrelOptimized: true,
    suppressorSafe: true,
    lowFlash: true,
    lowRecoil: true,
    matchGrade: false,
    controlledExpansion: false,
    muzzleVelocityFps: 1120,
    currentPrice: 0.32,
    inStock: true,
  },
  {
    id: 'p2-9mm-defense-hornady',
    caliberNorm: '9mm',
    purpose: 'Defense',
    brand: 'Hornady',
    caseMaterial: 'Brass',
    grainWeight: 124,
    bulletType: 'JHP',
    pressureRating: 'PLUS_P',
    isSubsonic: false,
    shortBarrelOptimized: true,
    suppressorSafe: false,
    lowFlash: true,
    lowRecoil: false,
    matchGrade: false,
    controlledExpansion: true,
    muzzleVelocityFps: 1180,
    currentPrice: 0.88,
    inStock: true,
  },
  {
    id: 'p3-223-target-federal',
    caliberNorm: '.223 remington 5.56 nato',
    purpose: 'Target',
    brand: 'Federal',
    caseMaterial: 'Brass',
    grainWeight: 62,
    bulletType: 'FMJ',
    pressureRating: 'NATO',
    isSubsonic: false,
    shortBarrelOptimized: false,
    suppressorSafe: false,
    lowFlash: false,
    lowRecoil: false,
    matchGrade: false,
    controlledExpansion: false,
    muzzleVelocityFps: 3020,
    currentPrice: 0.6,
    inStock: true,
  },
  {
    id: 'p4-9mm-target-steel',
    caliberNorm: '9mm',
    purpose: 'Target',
    brand: 'Tula',
    caseMaterial: 'Steel',
    grainWeight: 115,
    bulletType: 'FMJ',
    pressureRating: 'STANDARD',
    isSubsonic: false,
    shortBarrelOptimized: false,
    suppressorSafe: false,
    lowFlash: false,
    lowRecoil: false,
    matchGrade: false,
    controlledExpansion: false,
    muzzleVelocityFps: 1090,
    currentPrice: 0.27,
    inStock: false,
  },
  {
    id: 'p5-9mm-subsonic-federal',
    caliberNorm: '9mm',
    purpose: 'Target',
    brand: 'Federal',
    caseMaterial: 'Brass',
    grainWeight: 147,
    bulletType: 'FMJ',
    pressureRating: 'STANDARD',
    isSubsonic: true,
    shortBarrelOptimized: false,
    suppressorSafe: true,
    lowFlash: true,
    lowRecoil: true,
    matchGrade: false,
    controlledExpansion: false,
    muzzleVelocityFps: 950,
    currentPrice: 0.44,
    inStock: true,
  },
  {
    id: 'p6-9mm-match-speer',
    caliberNorm: '9mm',
    purpose: 'Target',
    brand: 'Speer',
    caseMaterial: 'Brass',
    grainWeight: 124,
    bulletType: 'JHP',
    pressureRating: 'STANDARD',
    isSubsonic: false,
    shortBarrelOptimized: false,
    suppressorSafe: false,
    lowFlash: false,
    lowRecoil: true,
    matchGrade: true,
    controlledExpansion: true,
    muzzleVelocityFps: 1140,
    currentPrice: 0.91,
    inStock: true,
  },
]
