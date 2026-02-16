import { describe, it, expect } from 'vitest'
import {
  normalizeCaliberString,
  extractGrainWeight,
  extractRoundCount,
  extractBrand,
  deriveShotgunLoadType,
} from '../ammo-utils'

describe('extractGrainWeight', () => {
  it('extracts integer grain weight', () => {
    expect(extractGrainWeight('Federal 9mm 115gr FMJ')).toBe(115)
    expect(extractGrainWeight('Winchester 55 grain FMJ')).toBe(55)
  })

  it('extracts decimal grain weight', () => {
    expect(extractGrainWeight('Hornady .17 HMR 15.5gr V-MAX')).toBe(15.5)
    expect(extractGrainWeight('CCI 17.5 grain polymer tip')).toBe(17.5)
  })

  it('rejects grain outside valid range', () => {
    expect(extractGrainWeight('Test 10gr tiny')).toBeNull() // too small
    expect(extractGrainWeight('Test 900gr huge')).toBeNull() // too large
  })

  it('does not extract shotgun oz as grain', () => {
    // "1oz" should not be parsed as grain
    expect(extractGrainWeight('Federal 12ga 1oz slug')).toBeNull()
  })
})

describe('normalizeCaliberString', () => {
  it('normalizes 5.56mm NATO', () => {
    const result = normalizeCaliberString('Winchester USA 5.56mm NATO 55gr M193 FMJ')
    expect(result).toBe('5.56 NATO')
  })

  it('normalizes 5.56 without NATO suffix', () => {
    const result = normalizeCaliberString('Lake City M855 Green Tip 5.56 - 62 Grain Penetrator')
    expect(result).toBe('5.56 NATO')
  })

  it('normalizes 5.56x45mm', () => {
    const result = normalizeCaliberString('5.56x45mm')
    expect(result).toBe('5.56 NATO')
  })

  it('normalizes .357 SIG', () => {
    const result = normalizeCaliberString('Federal .357 SIG 125gr FMJ')
    expect(result).toBe('.357 SIG')
  })

  it('normalizes 7.62x39mm', () => {
    const result = normalizeCaliberString('7.62x39mm 123gr FMJ')
    expect(result).toBe('7.62x39mm')
  })
})

describe('extractRoundCount', () => {
  it('extracts standard round patterns', () => {
    expect(extractRoundCount('Federal 9mm 115gr FMJ - 50 Rounds')).toBe(50)
    expect(extractRoundCount('Winchester 100rd Value Pack')).toBe(100)
    expect(extractRoundCount('Hornady 20-count box')).toBe(20)
  })

  it('extracts box/pack shorthand patterns', () => {
    expect(extractRoundCount('PMC Bronze .45 ACP 230gr 50/box')).toBe(50)
    expect(extractRoundCount('Federal 9mm pk of 50')).toBe(50)
    expect(extractRoundCount('CCI .22LR pack of 100')).toBe(100)
    expect(extractRoundCount('Blazer 9mm 50pk')).toBe(50)
    expect(extractRoundCount('Speer Gold Dot 20-pk')).toBe(20)
    expect(extractRoundCount('Winchester 25-pack')).toBe(25)
  })

  it('extracts qty patterns', () => {
    expect(extractRoundCount('Federal 9mm FMJ qty 50')).toBe(50)
    expect(extractRoundCount('Hornady .308 qty: 20')).toBe(20)
  })

  it('extracts parenthetical count at end', () => {
    expect(extractRoundCount('Federal American Eagle 9mm 115gr FMJ (50)')).toBe(50)
    expect(extractRoundCount('Winchester .223 55gr (20)')).toBe(20)
  })

  it('does not false-match caliber dimensions', () => {
    // "7.62x39" should NOT extract 39 as round count
    expect(extractRoundCount('Federal 7.62x39mm 123gr SP')).toBeNull()
    // "5.56x45" should NOT extract 45 as round count
    expect(extractRoundCount('Winchester 5.56x45mm M855')).toBeNull()
    // "x50" notation intentionally not supported (too many false positives with model names)
    expect(extractRoundCount('Acme X50 Premium Ammo')).toBeNull()
  })

  it('extracts bulk/case patterns', () => {
    expect(extractRoundCount('Blazer Brass 9mm Bulk 1000')).toBe(1000)
    expect(extractRoundCount('Federal 9mm case of 500')).toBe(500)
  })

  it('rejects counts outside valid range', () => {
    expect(extractRoundCount('Test ammo 3 rounds')).toBeNull() // too small
    expect(extractRoundCount('Test ammo 15000 rounds')).toBeNull() // too large
  })

  it('extracts "X Per Box" pattern', () => {
    expect(extractRoundCount('Barnes Defense 12 Gauge 00 Buck Shot - 5 Per Box')).toBe(5)
    expect(extractRoundCount('Federal 9mm 25 per box')).toBe(25)
  })
})

describe('deriveShotgunLoadType', () => {
  it('returns slug weight when present', () => {
    expect(deriveShotgunLoadType('Federal 12ga 1oz slug')).toBe('1oz Slug')
  })

  it('returns slug when weight is missing', () => {
    expect(deriveShotgunLoadType('Hornady 12 Gauge Slug - 25 Round Box')).toBe('Slug')
  })

  it('extracts rubber ball rounds', () => {
    expect(deriveShotgunLoadType('Sellier & Bellot 12 Gauge 1 Ball Rubber Ammunition')).toBe('1 Ball Rubber')
    expect(deriveShotgunLoadType('S&B 12ga 2 Ball Rubber')).toBe('2 Ball Rubber')
  })

  it('extracts ball rounds without material', () => {
    expect(deriveShotgunLoadType('12 Gauge 1 Ball Round')).toBe('1 Ball')
  })

  it('extracts bean bag rounds', () => {
    expect(deriveShotgunLoadType('Defense Technology 12ga Bean Bag Round')).toBe('Bean Bag')
    expect(deriveShotgunLoadType('Less Lethal Beanbag 12 Gauge')).toBe('Bean Bag')
  })

  it('extracts rubber buckshot', () => {
    expect(deriveShotgunLoadType('12 Gauge Rubber Buckshot')).toBe('Rubber Buck')
    expect(deriveShotgunLoadType('Rubber Buck 12ga Round')).toBe('Rubber Buck')
    expect(deriveShotgunLoadType('Sellier & Bellot Rubber 12 Gauge Buck Shot Ammunition')).toBe('Rubber Buck')
  })

  it('extracts "Number X Shot" pattern', () => {
    expect(deriveShotgunLoadType('410 Federal Judge Handgun Number 4 Shot 2.5 inch Ammo')).toBe('4 Shot')
  })

  it('falls back to generic buckshot when size is missing', () => {
    expect(deriveShotgunLoadType('25 Round Box - 410 Gauge Dual Sized Pellet Buckshot Load')).toBe('Buckshot')
  })
})

// ============================================================================
// NEW CALIBER PATTERN TESTS
// ============================================================================

describe('normalizeCaliberString - new/fixed patterns', () => {
  it.each([
    ['500 SW 300 Grain', '.500 S&W Magnum'],
    ['.500 S&W 350gr', '.500 S&W Magnum'],
    ['327 Magnum 80 Grain', '.327 Federal Magnum'],
    ['327 Mag 85gr', '.327 Federal Magnum'],
    ['.327 Federal Magnum 100gr', '.327 Federal Magnum'],
    ['41 Remington Magnum 190gr', '.41 Magnum'],
    ['41 Rem Mag 210gr', '.41 Magnum'],
    ['.41 Mag 170gr', '.41 Magnum'],
    ['460 Smith and Wesson 200gr', '.460 S&W Magnum'],
    ['460 Smith & Wesson 250gr', '.460 S&W Magnum'],
    ['7mm Magnum 174 Grain SP', '7mm Remington Magnum'],
    ['7mm Mag 140gr Nosler', '7mm Remington Magnum'],
    ['32 HR Magnum 85gr', '.32 H&R Magnum'],
    ['32 HR Mag 95gr', '.32 H&R Magnum'],
    ['.32 H&R Magnum 80gr', '.32 H&R Magnum'],
    ['50 Cal BMG Hornady', '.50 BMG'],
    ['50 Cal BMG 660gr', '.50 BMG'],
    ['.50 BMG 750gr AMAX', '.50 BMG'],
    ['6.8mm SPC 100 Grain', '6.8 SPC'],
    ['6.8 SPC 115gr', '6.8 SPC'],
    ['22 Cal Win Magnum 30gr', '.22 WMR'],
    ['22 Cal Winchester Mag 40gr', '.22 WMR'],
    ['22 Cal Long Rifle Federal', '.22 LR'],
    ['22 Cal Long Rifle 36gr HP', '.22 LR'],
    ['410 Judge Handgun Load', '.410 Bore'],
    ['410 Federal Judge Handgun Number 4 Shot 2.5 inch Ammo', '.410 Bore'],
    ['410 Judge 000 Buck', '.410 Bore'],
    ['20 Round Box - 223 69 Grain BTHP Match Ammo', '.223 Remington'],
    ['1000 Round Case - 40 HST Federal LE 165 Grain Hollow Point Ammo', '.40 S&W'],
    ['.223 WSSM 55gr', '.223 WSSM'],
    ['223 WSSM 64 grain SP', '.223 WSSM'],
  ])('normalizes "%s" → %s', (input, expected) => {
    expect(normalizeCaliberString(input)).toBe(expected)
  })
})

// ============================================================================
// NEW BRAND TESTS
// ============================================================================

describe('extractBrand - new brands', () => {
  it.each([
    ['Piney Mountain 22LR Tracer 50rd', 'Piney Mountain'],
    ['Stars and Stripes 9mm 115gr FMJ', 'Stars and Stripes'],
    ['Panzer Defense 12ga Slug', 'Panzer Defense'],
    ['Lake City M855 5.56 62gr', 'Lake City'],
    ['Ammo Incorporated 9mm 115gr TMC', 'Ammo Inc'],
    ['NobelSport 12ga 2-3/4" Target', 'NobelSport'],
    ['GGG 5.56 NATO 62gr', 'GGG'],
    ['Maxxtech 9mm 115gr FMJ', 'Maxxtech'],
    ['ADI 308 Win 150gr SP', 'ADI'],
    ['Supernova 22LR Tracer Round', 'Piney Mountain'],
    // Country-of-origin pseudo-brands
    ['7.62x54R Czech 148 Grain FMJ Light Ball', 'Czech Surplus'],
    ['8mm Mauser 155 Grain FMJ Turkish Surplus', 'Turkish Surplus'],
    ['8mm Mauser 196 Grain FMJ Yugo 1950s', 'Yugoslav Surplus'],
    ['9x18 Makarov Bulgarian 94 Grain FMJ', 'Bulgarian Surplus'],
    ['7.62x51 German SRTA 147gr FMJ', 'German Surplus'],
    ['WWII Vintage German Ammo 8mm Mauser', 'German Surplus'],
    ['30-06 150 Grain FMJ M2 Ball By Korean Arms', 'Korean Arms'],
    ['8mm Mauser 154 Grain FMJ Made in Romania', 'Romanian Surplus'],
    // Standalone Sellier
    ['Sellier 9mm 124gr FMJ', 'Sellier & Bellot'],
    // Superformance product line (no SST/ELD/XTP tokens)
    ['Superformance 308 Win 165gr SP', 'Hornady'],
  ])('extracts brand from "%s" → %s', (input, expected) => {
    expect(extractBrand(input)).toBe(expected)
  })
})

// ============================================================================
// BRAND PRECEDENCE: REAL BRANDS WIN OVER COUNTRY PSEUDO-BRANDS
// ============================================================================

describe('extractBrand - precedence: real brand wins over country token', () => {
  it.each([
    ['Federal Czech Surplus 9mm 115gr FMJ', 'Federal'],
    ['Hornady Turkish Military 8mm 196gr', 'Hornady'],
    ['Winchester German Surplus 308 Win', 'Winchester'],
    ['PPU Yugoslav M67 7.62x39', 'Prvi Partizan'],
  ])('real brand wins in "%s" → %s', (input, expected) => {
    expect(extractBrand(input)).toBe(expected)
  })

  it('bare "German" without suffix does not match', () => {
    expect(extractBrand('German 9mm 124gr FMJ')).toBeNull()
  })
})

// ============================================================================
// UNICODE CALIBER PATTERNS
// ============================================================================

describe('normalizeCaliberString - unicode multiplication sign', () => {
  it.each([
    ['7.5×55 Swiss GP11', '7.5x55mm Swiss'],
    ['7.5×54 French MAS', '7.5x54mm French'],
  ])('normalizes "%s" → %s', (input, expected) => {
    expect(normalizeCaliberString(input)).toBe(expected)
  })
})

// ============================================================================
// ROUND COUNT COMMA FIX
// ============================================================================

describe('extractRoundCount - comma-separated numbers', () => {
  it('extracts comma-separated round counts', () => {
    expect(extractRoundCount('10,000 Rounds - 5.7x28')).toBe(10000)
    expect(extractRoundCount('Federal 9mm 1,000 Round Case')).toBe(1000)
    expect(extractRoundCount('Bulk 5,000 Rounds 22LR')).toBe(5000)
  })

  it('still extracts non-comma round counts', () => {
    expect(extractRoundCount('Federal 9mm 115gr FMJ - 50 Rounds')).toBe(50)
    expect(extractRoundCount('Winchester 1000 Round Case')).toBe(1000)
  })
})

// ============================================================================
// GRAIN EDGE CASE
// ============================================================================

describe('extractGrainWeight - edge cases', () => {
  it('extracts grain when followed directly by product name', () => {
    expect(extractGrainWeight('50 GrainV-Max Hornady')).toBe(50)
    expect(extractGrainWeight('55 GrainFMJ Federal')).toBe(55)
  })

  it('still extracts normal grain patterns', () => {
    expect(extractGrainWeight('Federal 124gr JHP')).toBe(124)
    expect(extractGrainWeight('Winchester 180 grain SP')).toBe(180)
  })
})
