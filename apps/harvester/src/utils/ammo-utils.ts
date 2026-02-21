import crypto from 'crypto'
import { normalizeUpc as sharedNormalizeUpc } from '@ironscout/upc'

/**
 * Ammunition Normalization Utilities
 *
 * Provides deterministic parsing and normalization of ammunition product data
 * to ensure proper consolidation across different retailers.
 */

// ============================================================================
// CALIBER NORMALIZATION
// ============================================================================

interface CaliberPattern {
  pattern: RegExp
  normalized: string
  aliases?: string[]
}

const CALIBER_PATTERNS: CaliberPattern[] = [
  // Pistol calibers
  { pattern: /\b9\s?mm|9x19|9\s?luger\b/i, normalized: '9mm' },
  { pattern: /\b9x18\s?mak(?:arov)?\b|9\s?makarov\b/i, normalized: '9x18mm Makarov' },
  { pattern: /(?:^|\s|\W)\.?\s?45\s?acp\b|45\s?acp\b|45\s?auto\b/i, normalized: '.45 ACP' },
  { pattern: /(?:^|\s|\W)\.?\s?45\s?gap\b|45\s?gap\b/i, normalized: '.45 GAP' },
  { pattern: /(?:^|\s|\W)\.?\s?45\s?colt\b|45\s?long\s?colt\b|\.?45\s?lc\b/i, normalized: '.45 Colt' },
  { pattern: /(?:^|\s|\W)\.?\s?40\s?s&w\b|40\s?s&w\b|40\s?sw\b|40\s?cal\b|(?:^|\s|\W)\.?\s?40\b(?!\s?(?:mm|s&w|sw|cal|super))/i, normalized: '.40 S&W' },
  { pattern: /(?:^|\s|\W)\.?\s?38\s?special\b|38\s?spl\b/i, normalized: '.38 Special' },
  { pattern: /(?:^|\s|\W)\.?\s?38\s?super\b/i, normalized: '.38 Super' },
  { pattern: /(?:^|\s|\W)\.?\s?38\s?sw\b/i, normalized: '.38 S&W' },
  { pattern: /(?:^|\s|\W)\.?\s?38\s?long\s?colt\b/i, normalized: '.38 Long Colt' },
  { pattern: /(?:^|\s|\W)\.?\s?38\s?short\s?colt\b/i, normalized: '.38 Short Colt' },
  { pattern: /(?:^|\s|\W)\.?\s?44\s?russian\b/i, normalized: '.44 Russian' },
  { pattern: /(?:^|\s|\W)\.?\s?45\s?schofield\b/i, normalized: '.45 Schofield' },
  { pattern: /\b9x21\b/i, normalized: '9x21mm' },
  { pattern: /(?:^|\s|\W)\.?\s?357\s?mag\b|357\s?magnum\b/i, normalized: '.357 Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?357\s?sig\b|357\s?sig\b/i, normalized: '.357 SIG' },
  { pattern: /(?:^|\s|\W)\.?\s?327\s?fed(?:eral)?\s?mag(?:num)?\b|327\s?mag(?:num)?\b/i, normalized: '.327 Federal Magnum' },
  { pattern: /\b10\s?mm|10mm\s?auto\b/i, normalized: '10mm Auto' },
  { pattern: /(?:^|\s|\W)\.?\s?380\s?acp\b|380\s?auto\b/i, normalized: '.380 ACP' },
  { pattern: /(?:^|\s|\W)\.?\s?32\s?acp\b|32\s?auto\b/i, normalized: '.32 ACP' },
  { pattern: /(?:^|\s|\W)\.?\s?32\s?h&?r\s?mag(?:num)?\b/i, normalized: '.32 H&R Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?32\s?win\.?\s?(?:chester)?\s?(?:special|spl)\b|32\s?special\b/i, normalized: '.32 Winchester Special' },
  { pattern: /(?:^|\s|\W)\.?\s?32-20\s?win(?:chester)?\b|32-20\b/i, normalized: '.32-20 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?25\s?acp\b|25\s?auto\b/i, normalized: '.25 ACP' },
  { pattern: /\b5\.7x28(?:mm)?\b|5\.7\s?fn\b/i, normalized: '5.7x28mm' },
  { pattern: /\b4\.6\s?x?\s?30(?:mm)?\b/i, normalized: '4.6x30mm' },
  { pattern: /(?:^|\s|\W)\.?\s?44\s?(?:rem(?:ingto[nm])?\s+)?mag(?:num)?\b/i, normalized: '.44 Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?44\s?special\b|44\s?spl\b/i, normalized: '.44 Special' },
  { pattern: /(?:^|\s|\W)\.?\s?44-40\s?win(?:chester)?\b|44-40\b/i, normalized: '.44-40 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?41\s?(?:rem(?:ington)?\s?)?mag(?:num)?\b/i, normalized: '.41 Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?454\s?casull\b/i, normalized: '.454 Casull' },
  { pattern: /(?:^|\s|\W)\.?\s?460\s?s&w\b|460\s?sw\s?mag(?:num)?\b|460\s?smith\s*(?:and|&)\s*wesson\b/i, normalized: '.460 S&W Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?500\s?s&w\b|500\s?sw\b/i, normalized: '.500 S&W Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?50\s?ae\b|50\s?action\s?express\b/i, normalized: '.50 Action Express' },
  { pattern: /(?:^|\s|\W)\.?\s?30\s?super\s?carry\b/i, normalized: '.30 Super Carry' },
  { pattern: /\b7\.62x38r?\s?nagant\b|7\.62\s?nagant\b/i, normalized: '7.62x38R Nagant' },
  { pattern: /\b7\.63\s?mauser\b|7\.63x25\b/i, normalized: '7.63x25mm Mauser' },
  { pattern: /(?:^|\s|\W)\.?\s?38-40\b|38-40\s?win(?:chester)?\b/i, normalized: '.38-40 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?32\s?s&w\s?long\b|32\s?sw\s?long\b/i, normalized: '.32 S&W Long' },
  { pattern: /(?:^|\s|\W)\.?\s?480\s?ruger\b/i, normalized: '.480 Ruger' },

  // Rimfire calibers
  { pattern: /(?:^|\s|\W)\.?\s?22\s?lr\b|22\s?long\s?rifle\b|22\s?cal\s?long\s?rifle\b/i, normalized: '.22 LR' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?wmr\b|22\s?win(?:chester)?\s?mag(?:num)?\b|22\s?magnum\b|22\s?cal\s?win(?:chester)?\s?mag(?:num)?\b/i, normalized: '.22 WMR' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?short\b/i, normalized: '.22 Short' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?long\b(?!\s?rifle)/i, normalized: '.22 Long' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?rem(?:ingto[nm])?\s?jet\b/i, normalized: '.22 Remington Jet' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?wrf\b/i, normalized: '.22 WRF' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?arc\b/i, normalized: '.22 ARC' },
  { pattern: /(?:^|\s|\W)\.?\s?17\s?hmr\b|17\s?hornady\s?mag(?:num)?\b/i, normalized: '.17 HMR' },
  { pattern: /(?:^|\s|\W)\.?\s?17\s?wsm\b|17\s?win(?:chester)?\s?super\s?mag\b/i, normalized: '.17 WSM' },
  { pattern: /(?:^|\s|\W)\.?\s?17\s?mach\s?2\b|17\s?hm2\b/i, normalized: '.17 Mach 2' },
  { pattern: /(?:^|\s|\W)\.?\s?17\s?hornet\b/i, normalized: '.17 Hornet' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?hornet\b/i, normalized: '.22 Hornet' },
  { pattern: /(?:^|\s|\W)\.?\s?21\s?sharp\b|21\s?firesharp\b/i, normalized: '.21 Firesharp' },
  { pattern: /(?:^|\s|\W)\.?\s?218\s?bee\b/i, normalized: '.218 Bee' },

  // Rifle calibers - 5.45/5.56/.223
  { pattern: /\b5\.45x39(?:mm)?\b/i, normalized: '5.45x39mm' },
  { pattern: /\b5\.56(?:\s?mm)?(?:\s?nato)?\b|5\.56x45(?:mm)?\b/i, normalized: '5.56 NATO' },
  { pattern: /(?:^|\s|\W)\.?\s?223\s?rem(?:ingto[nm])?\b/i, normalized: '.223 Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?222\s?rem(?:ingto[nm])?\b/i, normalized: '.222 Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?224\s?valkyrie\b/i, normalized: '.224 Valkyrie' },
  { pattern: /(?:^|\s|\W)\.?\s?22-250\b|22-250\s?rem(?:ingto[nm])?\b/i, normalized: '.22-250 Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?223\s?wssm\b/i, normalized: '.223 WSSM' },
  { pattern: /(?:^|\s|\W)\.?\s?223\b(?!\s?wssm)(?!\s?rem(?:ingto[nm])?)/i, normalized: '.223 Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?22\s?creedmoor\b/i, normalized: '.22 Creedmoor' },
  { pattern: /(?:^|\s|\W)\.?\s?220\s?swift\b/i, normalized: '.220 Swift' },
  { pattern: /(?:^|\s|\W)\.?\s?204\s?ruger\b/i, normalized: '.204 Ruger' },

  // Rifle calibers - 6mm
  { pattern: /\b6mm\s?creedmoor|6mm\s?cm\b|6\s?creedmoor\b/i, normalized: '6mm Creedmoor' },
  { pattern: /\b6mm\s?arc\b|6\s?arc\b/i, normalized: '6mm ARC' },
  { pattern: /\b6mm\s?gt\b/i, normalized: '6mm GT' },
  { pattern: /\b6mm\s?rem(?:ingto[nm])?\b/i, normalized: '6mm Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?243\s?win(?:chester)?\b/i, normalized: '.243 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?243\s?wssm\b/i, normalized: '.243 WSSM' },
  { pattern: /(?:^|\s|\W)\.?\s?240\s?wby\b|240\s?weatherby\b/i, normalized: '.240 Weatherby' },

  // Rifle calibers - 5.6mm
  { pattern: /\b5\.6x50r\s?mag(?:num)?\b/i, normalized: '5.6x50R Magnum' },

  // Rifle calibers - 6.5mm
  { pattern: /\b6\.5\s?creedmoor|6\.5\s?cm\b/i, normalized: '6.5 Creedmoor' },
  { pattern: /\b6\.5\s?prc\b|6\.5\s?precision\s?rifle\b/i, normalized: '6.5 PRC' },
  { pattern: /\b6\.5\s?grendel\b/i, normalized: '6.5 Grendel' },
  { pattern: /\b6\.5x55(?:mm)?(?:\s?swedish)?\b|6\.5\s?swede\b|6\.5\s?swedish\b/i, normalized: '6.5x55mm Swedish' },
  { pattern: /\b6\.5x52\s?carcano\b|6\.5\s?carcano\b/i, normalized: '6.5x52mm Carcano' },
  { pattern: /\b6\.5x54\s?mann(?:licher)?\s?(?:schoenauer)?\b/i, normalized: '6.5x54mm Mannlicher-Schoenauer' },
  { pattern: /\b6\.5x57r?\b|6\.5x57\s?mauser\b/i, normalized: '6.5x57mm Mauser' },
  { pattern: /(?:^|\s|\W)\.?\s?264\s?win(?:chester)?\s?mag(?:num)?\b/i, normalized: '.264 Winchester Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?260\s?rem(?:ingto[nm])?\b/i, normalized: '.260 Remington' },
  { pattern: /\b6\.5-284\s?norma\b|6\.5-284\b/i, normalized: '6.5-284 Norma' },

  // Rifle calibers - 6.8mm
  { pattern: /\b6\.8(?:mm)?\s?spc\b|6\.8\s?rem(?:ingto[nm])?\s?spc\b/i, normalized: '6.8 SPC' },
  { pattern: /\b6\.8\s?western\b/i, normalized: '6.8 Western' },

  // Rifle calibers - 7mm
  // NOTE: 7mm RUM must be before 7mm Rem Mag to avoid misclassification
  { pattern: /\b7mm\s?rum\b|7mm\s?rem(?:ingto[nm])?\s?ultra\s?mag(?:num)?\b/i, normalized: '7mm Remington Ultra Magnum' },
  { pattern: /\b7mm\s?rem(?:ingto[nm])?\s?mag(?:num)?\b|7mm\s?rem\s?mag\b/i, normalized: '7mm Remington Magnum' },
  { pattern: /\b7mm-08\b|7mm-08\s?rem(?:ingto[nm])?\b/i, normalized: '7mm-08 Remington' },
  { pattern: /\b7mm\s?prc\b/i, normalized: '7mm PRC' },
  { pattern: /\b7mm\s?wsm\b|7mm\s?win(?:chester)?\s?short\s?mag\b/i, normalized: '7mm WSM' },
  { pattern: /\b7mm\s?wby\b|7mm\s?weatherby\b|7mm\s?weatherby\s?mag(?:num)?\b/i, normalized: '7mm Weatherby Magnum' },
  { pattern: /\b7mm\s?stw\b|7mm\s?shooting\s?times\b/i, normalized: '7mm STW' },
  { pattern: /\b7mm\s?mag(?:num)?\b/i, normalized: '7mm Remington Magnum' },
  { pattern: /\b7-30\s?waters\b/i, normalized: '7-30 Waters' },
  { pattern: /\b7x57r?\b|7mm\s?mauser\b/i, normalized: '7x57mm Mauser' },
  { pattern: /\b7x64\b/i, normalized: '7x64mm Brenneke' },
  { pattern: /\b7x65r\b/i, normalized: '7x65R' },
  { pattern: /\b7\.5[x×]54\s?french\b|7\.5\s?french\s?mas\b|7\.5[x×]54\s?mas\b/i, normalized: '7.5x54mm French' },
  { pattern: /\b7\.5[x×]55\s?swiss\b|7\.5\s?swiss\b/i, normalized: '7.5x55mm Swiss' },
  { pattern: /\b7\.65x53\s?(?:argentine|arg)?\s?(?:mauser)?\b/i, normalized: '7.65x53mm Argentine' },
  { pattern: /\b7\.65\s?mm?\s?para(?:bellum)?\b|7\.65\s?para\b/i, normalized: '7.65mm Parabellum' },
  { pattern: /(?:^|\s|\W)\.?\s?280\s?rem(?:ingto[nm])?\b/i, normalized: '.280 Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?280\s?ackley\b|280\s?ai\b/i, normalized: '.280 Ackley Improved' },
  { pattern: /(?:^|\s|\W)\.?\s?270\s?win(?:chester)?\b/i, normalized: '.270 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?270\s?wsm\b|270\s?win(?:chester)?\s?short\s?mag\b/i, normalized: '.270 WSM' },
  { pattern: /(?:^|\s|\W)\.?\s?270\s?wby\b|270\s?weatherby\b/i, normalized: '.270 Weatherby' },

  // Rifle calibers - 7.62
  { pattern: /\b7\.62x39(?:mm)?\b/i, normalized: '7.62x39mm' },
  { pattern: /\b7\.62\s?nato|7\.62x51|(?:^|\s|\W)\.?\s?308\s?win(?:chester)?\b/i, normalized: '.308 Winchester' },
  { pattern: /\b7\.62x54r\b/i, normalized: '7.62x54R' },
  { pattern: /\b7\.62x25\b|7\.62\s?tokarev\b/i, normalized: '7.62x25mm Tokarev' },

  // Rifle calibers - 8mm
  { pattern: /\b8mm\s?mauser\b|7\.92x57(?:mm)?\b|8x57\b/i, normalized: '8mm Mauser' },
  { pattern: /\b8x57\s?jrs?\b/i, normalized: '8x57 JRS' },
  { pattern: /\b8x57\s?jr\b/i, normalized: '8x57 JR' },
  { pattern: /\b8x56r\s?mann(?:licher)?\b|8x56r\b/i, normalized: '8x56R Mannlicher' },
  { pattern: /\b8x50r?\s?lebel\b|8x51r?\s?lebel\b|8mm\s?lebel\b/i, normalized: '8mm Lebel' },
  { pattern: /\b8mm\s?rem(?:ingto[nm])?\s?mag(?:num)?\b/i, normalized: '8mm Remington Magnum' },
  { pattern: /\b8\.6\s?(?:blk|blackout)\b|8\.6x43\b/i, normalized: '8.6 Blackout' },

  // Rifle calibers - .303
  { pattern: /(?:^|\s|\W)\.?\s?303\s?brit(?:ish)?\b|303\s?brit\b/i, normalized: '.303 British' },

  // Rifle calibers - .30
  { pattern: /(?:^|\s|\W)\.?\s?30-06\b|30-06\s?springfield\b/i, normalized: '.30-06 Springfield' },
  { pattern: /(?:^|\s|\W)\.?\s?30\s?(?:cal\s+)?carbine\b|30\s?(?:cal\s+)?carbine\b/i, normalized: '.30 Carbine' },
  { pattern: /(?:^|\s|\W)\.?\s?30-30\b|30-30\s?win(?:chester)?\b/i, normalized: '.30-30 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?30-40\s?krag\b/i, normalized: '.30-40 Krag' },

  // .300 variants
  { pattern: /(?:^|\s|\W)\.?\s?300\s?(?:aac\s*)?blk\b|300\s?(?:aac\s*)?blackout\b/i, normalized: '.300 Blackout' },
  { pattern: /(?:^|\s|\W)\.?\s?300\s?win\s?mag\b|300\s?winchester\s?mag(?:num)?\b/i, normalized: '.300 Winchester Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?300\s?wsm\b|300\s?win(?:chester)?\s?short\s?mag(?:num)?\b/i, normalized: '.300 WSM' },
  { pattern: /(?:^|\s|\W)\.?\s?300\s?wby\b|300\s?weatherby\b/i, normalized: '.300 Weatherby' },
  { pattern: /(?:^|\s|\W)\.?\s?300\s?prc\b/i, normalized: '.300 PRC' },
  { pattern: /(?:^|\s|\W)\.?\s?300\s?rum\b|300\s?rem(?:ingto[nm])?\s?ultra\s?mag\b/i, normalized: '.300 RUM' },
  { pattern: /(?:^|\s|\W)\.?\s?300\s?savage\b/i, normalized: '.300 Savage' },
  { pattern: /(?:^|\s|\W)\.?\s?300\s?ham'?r\b/i, normalized: '.300 HAM\'R' },
  { pattern: /(?:^|\s|\W)\.?\s?308\s?mar(?:lin)?\s?exp(?:ress)?\b/i, normalized: '.308 Marlin Express' },

  // Rifle calibers - .25
  { pattern: /(?:^|\s|\W)\.?\s?25-06\b|25-06\s?rem(?:ingto[nm])?\b/i, normalized: '.25-06 Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?25-35\s?win(?:chester)?\b|25-35\b/i, normalized: '.25-35 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?25\s?creedmoor\b/i, normalized: '.25 Creedmoor' },
  { pattern: /(?:^|\s|\W)\.?\s?250\s?savage\b/i, normalized: '.250 Savage' },
  { pattern: /(?:^|\s|\W)\.?\s?257\s?roberts\b/i, normalized: '.257 Roberts' },
  { pattern: /(?:^|\s|\W)\.?\s?257\s?wby\b|257\s?weatherby\b/i, normalized: '.257 Weatherby' },
  { pattern: /(?:^|\s|\W)\.?\s?25\s?wssm\b/i, normalized: '.25 WSSM' },

  // Rifle calibers - .338
  { pattern: /(?:^|\s|\W)\.?\s?338\s?win\s?mag\b|338\s?winchester\s?mag(?:num)?\b/i, normalized: '.338 Winchester Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?338\s?lapua\b|338\s?lapua\s?mag(?:num)?\b/i, normalized: '.338 Lapua Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?338\s?norma\s?mag(?:num)?\b|338\s?norma\b/i, normalized: '.338 Norma Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?338\s?fed(?:eral)?\b/i, normalized: '.338 Federal' },
  { pattern: /(?:^|\s|\W)\.?\s?338\s?rum\b|338\s?rem(?:ingto[nm])?\s?ultra\s?mag\b/i, normalized: '.338 RUM' },
  { pattern: /(?:^|\s|\W)\.?\s?340\s?wby\b|340\s?weatherby\b/i, normalized: '.340 Weatherby' },
  { pattern: /(?:^|\s|\W)\.?\s?33\s?nosler\b/i, normalized: '.33 Nosler' },

  // Rifle calibers - .35/.358
  { pattern: /(?:^|\s|\W)\.?\s?348\s?win(?:chester)?\b/i, normalized: '.348 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?356\s?win(?:chester)?\b/i, normalized: '.356 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?358\s?win(?:chester)?\b/i, normalized: '.358 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?38-55\b/i, normalized: '.38-55 Winchester' },

  // Rifle calibers - .338 additional
  { pattern: /(?:^|\s|\W)\.?\s?338\s?arc\b/i, normalized: '.338 ARC' },
  { pattern: /(?:^|\s|\W)\.?\s?338\s?mar(?:lin)?\s?exp(?:ress)?\b/i, normalized: '.338 Marlin Express' },

  // Rifle calibers - .28/.325
  { pattern: /(?:^|\s|\W)\.?\s?28\s?nosler\b/i, normalized: '.28 Nosler' },
  { pattern: /(?:^|\s|\W)\.?\s?325\s?wsm\b/i, normalized: '.325 WSM' },

  // Rifle calibers - 9.3mm
  { pattern: /\b9\.3x74r\b/i, normalized: '9.3x74R' },
  { pattern: /\b9\.3x62\b/i, normalized: '9.3x62mm' },

  // Rifle calibers - Large bore
  { pattern: /(?:^|\s|\W)\.?\s?375\s?h&h\b|375\s?h&h\s?mag(?:num)?\b/i, normalized: '.375 H&H Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?375\s?ruger\b/i, normalized: '.375 Ruger' },
  { pattern: /(?:^|\s|\W)\.?\s?375\s?swiss\b/i, normalized: '.375 Swiss' },
  { pattern: /(?:^|\s|\W)\.?\s?376\s?steyr\b/i, normalized: '.376 Steyr' },
  { pattern: /(?:^|\s|\W)\.?\s?378\s?wby\b|378\s?weatherby\b/i, normalized: '.378 Weatherby Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?405\s?win(?:chester)?\b/i, normalized: '.405 Winchester' },
  { pattern: /(?:^|\s|\W)\.?\s?416\s?barrett\b/i, normalized: '.416 Barrett' },
  { pattern: /(?:^|\s|\W)\.?\s?416\s?rigby\b/i, normalized: '.416 Rigby' },
  { pattern: /(?:^|\s|\W)\.?\s?416\s?rem(?:ingto[nm])?\s?mag(?:num)?\b/i, normalized: '.416 Remington Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?416\s?ruger\b/i, normalized: '.416 Ruger' },
  { pattern: /(?:^|\s|\W)\.?\s?450\s?nitro\s?exp(?:ress)?\b/i, normalized: '.450 Nitro Express' },
  { pattern: /(?:^|\s|\W)\.?\s?458\s?lott\b/i, normalized: '.458 Lott' },
  { pattern: /(?:^|\s|\W)\.?\s?458\s?socom\b/i, normalized: '.458 SOCOM' },
  { pattern: /(?:^|\s|\W)\.?\s?458\s?win\s?mag\b|458\s?winchester\s?mag(?:num)?\b/i, normalized: '.458 Winchester Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?460\s?wby\b|460\s?weatherby\b/i, normalized: '.460 Weatherby Magnum' },
  { pattern: /(?:^|\s|\W)\.?\s?470\s?nitro\s?exp(?:ress)?\b|470\s?ne\b/i, normalized: '.470 Nitro Express' },
  { pattern: /(?:^|\s|\W)\.?\s?450\s?bushmaster\b/i, normalized: '.450 Bushmaster' },
  { pattern: /(?:^|\s|\W)\.?\s?50\s?bmg\b|50\s?bmg\b|50\s?cal\s?bmg\b/i, normalized: '.50 BMG' },
  { pattern: /(?:^|\s|\W)\.?\s?50\s?beowulf\b/i, normalized: '.50 Beowulf' },
  { pattern: /(?:^|\s|\W)\.?\s?500\s?nitro\s?exp(?:ress)?\b|500\s?ne\b/i, normalized: '.500 Nitro Express' },
  { pattern: /(?:^|\s|\W)\.?\s?505\s?gibbs\b/i, normalized: '.505 Gibbs' },

  // Straight-wall / lever-action
  { pattern: /(?:^|\s|\W)\.?\s?350\s?legend\b/i, normalized: '.350 Legend' },
  { pattern: /(?:^|\s|\W)\.?\s?400\s?legend\b/i, normalized: '.400 Legend' },
  { pattern: /(?:^|\s|\W)\.?\s?45-70\b|45-70\s?govt?\b|45-70\s?government\b/i, normalized: '.45-70 Government' },
  { pattern: /(?:^|\s|\W)\.?\s?45-90\b|45-90\s?wcf\b|45-90\s?win(?:chester)?\b/i, normalized: '.45-90 WCF' },
  { pattern: /(?:^|\s|\W)\.?\s?444\s?marlin\b/i, normalized: '.444 Marlin' },
  { pattern: /(?:^|\s|\W)\.?\s?450\s?marlin\b/i, normalized: '.450 Marlin' },
  { pattern: /(?:^|\s|\W)\.?\s?35\s?rem(?:ingto[nm])?\b/i, normalized: '.35 Remington' },
  { pattern: /(?:^|\s|\W)\.?\s?35\s?whelen\b/i, normalized: '.35 Whelen' },

  // Shotgun gauges
  { pattern: /\b12\s?ga|12\s?gauge\b/i, normalized: '12 Gauge' },
  { pattern: /\b20\s?ga|20\s?gauge\b/i, normalized: '20 Gauge' },
  { pattern: /\b16\s?ga|16\s?gauge\b/i, normalized: '16 Gauge' },
  { pattern: /\b28\s?ga|28\s?gauge\b/i, normalized: '28 Gauge' },
  { pattern: /\b10\s?ga(?:uge)?\b/i, normalized: '10 Gauge' },
  { pattern: /\b\.410\s?bore|410\s?bore\b|410\s?gauge\b|410\s?judge\b|\b\.?\s?410\b(?=[^\n]{0,30}\bjudge\b)/i, normalized: '.410 Bore' },
]

export function extractCaliber(productName: string): string | null {
  return normalizeCaliberString(productName)
}

export function normalizeCaliberString(value: string): string | null {
  if (!value) return null
  const name = value.toLowerCase()

  for (const { pattern, normalized } of CALIBER_PATTERNS) {
    if (pattern.test(name)) {
      return normalized
    }
  }

  return null
}

// ============================================================================
// GRAIN WEIGHT EXTRACTION
// ============================================================================

export function extractGrainWeight(productName: string): number | null {
  // Match patterns like "115gr", "124 gr", "55 grain", "62gn", "15.5gr"
  const patterns = [
    /(\d{2,3}(?:\.\d+)?)\s?gr(?:ain)?(?:s)?\b/i,
    /(\d{2,3}(?:\.\d+)?)\s?gn\b/i,  // "gn" variant (common in some feeds)
    /(\d{2,3}(?:\.\d+)?)\s?-?grain/i,
    /(\d{2,3}(?:\.\d+)?)\s?grn\b/i, // "grn" variant
  ]

  for (const pattern of patterns) {
    const match = productName.match(pattern)
    if (match) {
      const grain = parseFloat(match[1])
      // Sanity check: typical ammo grains range from 15 to 800
      // (lowered min for .17 HMR which uses 15.5-20gr bullets)
      if (grain >= 15 && grain <= 800) {
        return grain
      }
    }
  }

  return null
}

// ============================================================================
// CASE MATERIAL DETECTION
// ============================================================================

export type CaseMaterial = 'Brass' | 'Steel' | 'Aluminum' | 'Nickel-Plated' | 'Polymer-Coated' | null

export function extractCaseMaterial(productName: string): CaseMaterial {
  const name = productName.toLowerCase()

  // Check for specific materials in order of specificity
  if (/nickel\s?plated|nickel-plated|ni-?plated/i.test(name)) {
    return 'Nickel-Plated'
  }

  if (/polymer\s?coat|poly-?coat/i.test(name)) {
    return 'Polymer-Coated'
  }

  if (/\bbrass\b/i.test(name)) {
    return 'Brass'
  }

  if (/\bsteel\b/i.test(name)) {
    return 'Steel'
  }

  if (/\baluminum|aluminium\b/i.test(name)) {
    return 'Aluminum'
  }

  return null
}

// ============================================================================
// PURPOSE CLASSIFICATION
// ============================================================================

export type AmmoPurpose = 'Target' | 'Defense' | 'Hunting' | 'Precision' | 'Training' | null

interface BulletTypeClassification {
  patterns: RegExp[]
  purpose: AmmoPurpose
  description: string
}

const BULLET_TYPE_CLASSIFICATIONS: BulletTypeClassification[] = [
  {
    patterns: [/\bfmj\b|full\s?metal\s?jacket/i],
    purpose: 'Target',
    description: 'Full Metal Jacket - range/training ammunition'
  },
  {
    patterns: [/\bjhp\b|jacketed\s?hollow\s?point|hollow\s?point/i],
    purpose: 'Defense',
    description: 'Jacketed Hollow Point - defensive ammunition'
  },
  {
    patterns: [/\bsp\b|soft\s?point/i],
    purpose: 'Hunting',
    description: 'Soft Point - hunting ammunition'
  },
  {
    patterns: [/\botm\b|open\s?tip\s?match|match\s?grade/i],
    purpose: 'Precision',
    description: 'Open Tip Match - precision/competition'
  },
  {
    patterns: [/\bvmax\b|v-max|ballistic\s?tip|polymer\s?tip/i],
    purpose: 'Hunting',
    description: 'Polymer tip - hunting/varmint'
  },
  {
    patterns: [/\blead\s?round\s?nose|lrn\b/i],
    purpose: 'Training',
    description: 'Lead Round Nose - training/practice'
  },
  {
    patterns: [/\btotal\s?metal\s?jacket|tmj\b/i],
    purpose: 'Training',
    description: 'Total Metal Jacket - indoor range safe'
  },
]

export function classifyPurpose(productName: string): AmmoPurpose {
  const name = productName.toLowerCase()

  for (const { patterns, purpose } of BULLET_TYPE_CLASSIFICATIONS) {
    for (const pattern of patterns) {
      if (pattern.test(name)) {
        return purpose
      }
    }
  }

  return null
}

// ============================================================================
// PRODUCT ID GENERATION
// ============================================================================

/**
 * Generate a canonical product ID for deduplication
 *
 * Priority:
 * 1. If UPC exists, use UPC as the product ID
 * 2. Otherwise, generate a deterministic hash from normalized attributes
 */
export function generateProductId(product: {
  upc?: string | null
  name: string
  caliber?: string | null
  grainWeight?: number | null
  brand?: string | null
}): string {
  // If UPC exists, use it as the canonical ID
  if (product.upc) {
    return normalizeUPC(product.upc)
  }

  // Otherwise, generate a hash from normalized attributes
  // This creates a deterministic ID for products without UPC
  const components = [
    product.brand?.toLowerCase().trim() || 'unknown',
    product.caliber?.toLowerCase().trim() || '',
    product.grainWeight?.toString() || '',
    normalizeProductName(product.name),
  ]

  const hashInput = components.filter(Boolean).join('_')
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex')

  // Return a shorter, more readable ID
  return hash.substring(0, 16)
}

/**
 * Normalize UPC to a consistent format.
 * Uses shared validation, but falls back to raw digits for invalid lengths
 * because this feeds generateProductId (hash input, not a match key).
 */
function normalizeUPC(upc: string): string {
  return sharedNormalizeUpc(upc) ?? upc.replace(/\D/g, '')
}

/**
 * Clean and normalize product name for hashing
 */
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_')    // Replace spaces with underscore
    .trim()
}

// ============================================================================
// ROUND COUNT EXTRACTION
// ============================================================================

export function extractRoundCount(productName: string): number | null {
  // Match patterns like "50 rounds", "100rd", "500 count", "20-count"
  // Also handles bulk/case patterns like "case of 500", "bulk 1000"
  const patterns = [
    // Standard patterns (support comma-separated numbers like "10,000 Rounds")
    // Uses (\d[\d,]*) to match both plain digits and comma-formatted numbers
    /(\d[\d,]*)\s?(?:rounds?|rds?|count|ct)\b/i,
    /(\d[\d,]*)-(?:round|rd|count|ct)\b/i,
    /box\s?of\s?(\d[\d,]*)/i,
    // Bulk/case patterns
    /case\s?of\s?(\d[\d,]*)/i,
    /(\d[\d,]*)\s?(?:per\s?case|\/case)\b/i,
    /bulk\s?(\d[\d,]*)/i,
    /(\d[\d,]*)\s?(?:rd|round)s?\s?(?:bulk|case)\b/i,
    // Value pack patterns
    /value\s?pack\s?(?:of\s?)?(\d[\d,]*)/i,
    /(\d[\d,]*)\s?(?:rd|round)s?\s?value\s?pack/i,
    // Range pack patterns
    /range\s?pack\s?(?:of\s?)?(\d[\d,]*)/i,
    /(\d[\d,]*)\s?(?:rd|round)s?\s?range\s?pack/i,
    // Box/pack shorthand patterns
    /(\d[\d,]*)\/box\b/i,                        // "20/box"
    /(\d[\d,]*)\/bx\b/i,                         // "20/bx", "50/Bx"
    /(?:pk|pack)\s?of\s?(\d[\d,]*)/i,            // "pk of 20", "pack of 20"
    /(\d[\d,]*)\s?-?\s?pk\b/i,                   // "20pk", "20-pk", "20 pk"
    /(\d[\d,]*)\s?-?\s?pack\b/i,                 // "20-pack", "20 pack"
    /qty[:\s]*(\d[\d,]*)/i,                       // "qty 20", "qty: 20"
    /\((\d[\d,]*)\)\s*$/,                         // "(50)" at end of title
    /(\d[\d,]*)\s?per\s?box\b/i,                  // "5 Per Box", "5 per box"
    /(\d[\d,]*)\s?per\s?case\b/i,                 // "25 Per Case"
  ]

  for (const pattern of patterns) {
    const match = productName.match(pattern)
    if (match) {
      const count = parseInt(match[1].replace(/,/g, ''), 10)
      // Sanity check: typical sizes range from 5 to 10000 (bulk cases)
      if (count >= 5 && count <= 10000) {
        return count
      }
    }
  }

  // Common defaults by caliber if not explicitly stated
  // This could be enhanced based on caliber
  return null
}

// ============================================================================
// BRAND EXTRACTION
// ============================================================================

/**
 * Known ammunition brands for extraction from product titles.
 * Ordered by specificity (longer/more specific patterns first).
 */
const KNOWN_BRANDS: Array<{ pattern: RegExp; normalized: string }> = [
  // Multi-word brands (check first to avoid partial matches)
  { pattern: /\bsellier\s*[&and]*\s*bellot\b/i, normalized: 'Sellier & Bellot' },
  { pattern: /\bs&b\b/i, normalized: 'Sellier & Bellot' },
  { pattern: /\bammo\s*inc\b/i, normalized: 'Ammo Inc' },
  { pattern: /\bruag\b/i, normalized: 'RUAG' },
  { pattern: /\bprvi\s*partizan\b/i, normalized: 'Prvi Partizan' },
  { pattern: /\bppu\b/i, normalized: 'Prvi Partizan' },
  { pattern: /\bred\s*army\s*standard\b/i, normalized: 'Red Army Standard' },
  { pattern: /\bamerican\s*eagle\b/i, normalized: 'American Eagle' },
  { pattern: /\bbrown\s*bear\b/i, normalized: 'Brown Bear' },
  { pattern: /\bgolden\s*bear\b/i, normalized: 'Golden Bear' },
  { pattern: /\bsilver\s*bear\b/i, normalized: 'Silver Bear' },
  { pattern: /\bblack\s*hills\b/i, normalized: 'Black Hills' },
  { pattern: /\bbear\s*ammo\b/i, normalized: 'Bear Ammo' },
  { pattern: /\bsig\s*sauer\b/i, normalized: 'Sig Sauer' },
  { pattern: /\bsig\s*elite\b/i, normalized: 'Sig Sauer' },
  { pattern: /\bsmith\s*[&and]+\s*wesson\b/i, normalized: 'Smith & Wesson' },
  { pattern: /\bs&w\b/i, normalized: 'Smith & Wesson' },
  { pattern: /\bdouble\s*tap\b/i, normalized: 'DoubleTap' },
  { pattern: /\bunderwood\s*ammo\b/i, normalized: 'Underwood' },
  { pattern: /\bgeco\s*ammo\b/i, normalized: 'Geco' },
  { pattern: /\bfreedom\s*munitions\b/i, normalized: 'Freedom Munitions' },
  { pattern: /\bbuffalo\s*bore\b/i, normalized: 'Buffalo Bore' },
  { pattern: /\bcritical\s*defense\b/i, normalized: 'Hornady' },
  { pattern: /\bcritical\s*duty\b/i, normalized: 'Hornady' },
  { pattern: /\bromanian\s*surplus\b/i, normalized: 'Romanian Surplus' },
  { pattern: /\bpiney\s*mountain\b/i, normalized: 'Piney Mountain' },
  { pattern: /\bstars\s*and\s*stripes\b/i, normalized: 'Stars and Stripes' },
  { pattern: /\bpanzer\s*defense\b/i, normalized: 'Panzer Defense' },
  { pattern: /\blake\s*city\b/i, normalized: 'Lake City' },
  { pattern: /\bammo\s*incorporated\b/i, normalized: 'Ammo Inc' },

  // Single-word brands (alphabetical)
  { pattern: /\badi\b/i, normalized: 'ADI' },
  { pattern: /\baguila\b/i, normalized: 'Aguila' },
  { pattern: /\barmscor\b/i, normalized: 'Armscor' },
  { pattern: /\bbarnaul\b/i, normalized: 'Barnaul' },
  { pattern: /\bbarnes\b/i, normalized: 'Barnes' },
  { pattern: /\bblazer\b/i, normalized: 'Blazer' },
  { pattern: /\bbrowning\b/i, normalized: 'Browning' },
  { pattern: /\bcbc\b/i, normalized: 'CBC' },
  { pattern: /\bchallenger\b/i, normalized: 'Challenger' },
  { pattern: /\bcci\b/i, normalized: 'CCI' },
  { pattern: /\bcor-?bon\b/i, normalized: 'CorBon' },
  { pattern: /\belen\b/i, normalized: 'Eley' },
  { pattern: /\beley\b/i, normalized: 'Eley' },
  { pattern: /\bfederal\b/i, normalized: 'Federal' },
  { pattern: /\bfiocchi\b/i, normalized: 'Fiocchi' },
  { pattern: /\bgeco\b/i, normalized: 'Geco' },
  { pattern: /\bggg\b/i, normalized: 'GGG' },
  { pattern: /\bherters\b/i, normalized: 'Herter\'s' },
  { pattern: /\bhornady\b/i, normalized: 'Hornady' },
  { pattern: /\bhpr\b/i, normalized: 'HPR' },
  { pattern: /\bhsm\b/i, normalized: 'HSM' },
  { pattern: /\bimi\b/i, normalized: 'IMI' },
  { pattern: /\blapua\b/i, normalized: 'Lapua' },
  { pattern: /\blps\b/i, normalized: 'Romanian Surplus' },
  { pattern: /\bmagtech\b/i, normalized: 'Magtech' },
  { pattern: /\bmaxxtech\b/i, normalized: 'Maxxtech' },
  { pattern: /\bmeister\b/i, normalized: 'Meister' },
  { pattern: /\bnobelsport\b/i, normalized: 'NobelSport' },
  { pattern: /\bnorma\b/i, normalized: 'Norma' },
  { pattern: /\bnosler\b/i, normalized: 'Nosler' },
  { pattern: /\bpmc\b/i, normalized: 'PMC' },
  { pattern: /\bremingto[nm]\b/i, normalized: 'Remington' },
  { pattern: /\brio\b/i, normalized: 'Rio' },
  { pattern: /\brws\b/i, normalized: 'RWS' },
  { pattern: /\bsako\b/i, normalized: 'Sako' },
  { pattern: /\bsellier\b/i, normalized: 'Sellier & Bellot' },
  { pattern: /\bsierra\b/i, normalized: 'Sierra' },
  { pattern: /\bspeer\b/i, normalized: 'Speer' },
  { pattern: /\btulammo\b/i, normalized: 'TulAmmo' },
  { pattern: /\btula\b/i, normalized: 'TulAmmo' },
  { pattern: /\bunderwood\b/i, normalized: 'Underwood' },
  { pattern: /\bweatherby\b/i, normalized: 'Weatherby' },
  { pattern: /\bwinchester\b/i, normalized: 'Winchester' },
  { pattern: /\bwolf\b/i, normalized: 'Wolf' },
  { pattern: /\bytr\b/i, normalized: 'YTR' },
  { pattern: /\bzqi\b/i, normalized: 'ZQI' },
  { pattern: /\bigman\b/i, normalized: 'Igman' },
  { pattern: /\bsaltech\b/i, normalized: 'Saltech' },

  // Product line names that indicate brand
  { pattern: /\bgold\s*dot\b/i, normalized: 'Speer' },
  { pattern: /\bhst\b/i, normalized: 'Federal' },
  { pattern: /\bhydra-?shok\b/i, normalized: 'Federal' },
  { pattern: /\bv-?max\b/i, normalized: 'Hornady' },
  { pattern: /\beld-?x\b/i, normalized: 'Hornady' },
  { pattern: /\beld-?match\b/i, normalized: 'Hornady' },
  { pattern: /\bsst\b/i, normalized: 'Hornady' },
  { pattern: /\bxtp\b/i, normalized: 'Hornady' },
  { pattern: /\bcore-?lokt\b/i, normalized: 'Remington' },
  { pattern: /\bpower-?point\b/i, normalized: 'Winchester' },
  { pattern: /\bsilver\s*tip\b/i, normalized: 'Winchester' },
  { pattern: /\bpdx1\b/i, normalized: 'Winchester' },
  { pattern: /\bsuper-?x\b/i, normalized: 'Winchester' },
  { pattern: /\bsupernova\b/i, normalized: 'Piney Mountain' },
  { pattern: /\bsuperformance\b/i, normalized: 'Hornady' },
  { pattern: /\bv-?match\b/i, normalized: 'Hornady' },
  { pattern: /\bpremier\s*sts\b/i, normalized: 'Remington' },
  { pattern: /\btop\s*gun\b/i, normalized: 'Federal' },
  { pattern: /\bdeer\s*season\s*xp\b/i, normalized: 'Winchester' },
  { pattern: /\busa\s*white\s*box\b/i, normalized: 'Winchester' },
  { pattern: /\bgame\s*load\s*upland\b/i, normalized: 'Federal' },
  { pattern: /\baa\s*sporting\s*clays\b/i, normalized: 'Winchester' },
  { pattern: /\baa\s*heavy\s*target\b/i, normalized: 'Winchester' },
  { pattern: /\bgold\s*medal\b/i, normalized: 'Federal' },
  { pattern: /\bshooting\s*dynamics\b/i, normalized: 'Fiocchi' },
  { pattern: /\blong\s*beard\s*xr\b/i, normalized: 'Winchester' },
  { pattern: /\bxpert\s*game\b/i, normalized: 'Winchester' },
  { pattern: /\bamerican\s*whitetail\b/i, normalized: 'Hornady' },
  { pattern: /\bgun\s*club\s*target\b/i, normalized: 'Federal' },
  { pattern: /\bdove\s*[&and]+\s*quail\b/i, normalized: 'Federal' },
  { pattern: /\bgolden\s*pheasant\b/i, normalized: 'Fiocchi' },
  { pattern: /\bhi-?bird\b/i, normalized: 'Federal' },
  { pattern: /\bumc\b/i, normalized: 'Remington' },

  // Country-of-origin pseudo-brands (military surplus ammo)
  // Placed last so real brands always take precedence
  { pattern: /\bczech\s*(?:surplus|military)?\b/i, normalized: 'Czech Surplus' },
  { pattern: /\byugo(?:slav)?\s*(?:surplus|military)?\b/i, normalized: 'Yugoslav Surplus' },
  { pattern: /\bbulgarian\s*(?:surplus|military)?\b/i, normalized: 'Bulgarian Surplus' },
  { pattern: /\bturkish\s*(?:surplus|military)?\b/i, normalized: 'Turkish Surplus' },
  { pattern: /\bgerman\s*(?:surplus|military|srta|ammo|vintage)\b/i, normalized: 'German Surplus' },
  { pattern: /\bkorean\s*arms\b/i, normalized: 'Korean Arms' },
  { pattern: /\bmade\s+in\s+romania\b/i, normalized: 'Romanian Surplus' },
]

/**
 * Extract brand from product title.
 * Searches for known brand patterns in the title.
 *
 * @param productName - The product title to search
 * @returns The normalized brand name, or null if not found
 */
export function extractBrand(productName: string): string | null {
  if (!productName) return null

  for (const { pattern, normalized } of KNOWN_BRANDS) {
    if (pattern.test(productName)) {
      return normalized
    }
  }

  // Fallback: extract brand from "Made by X" or "Manufactured by X" patterns
  const madeByMatch = productName.match(/\b(?:made|manufactured|produced)\s+by\s+([A-Z][a-zA-Z]+)\b/i)
  if (madeByMatch) {
    // Capitalize first letter
    const brand = madeByMatch[1]
    return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
  }

  return null
}

// ============================================================================
// SHOTGUN SIGNAL EXTRACTION
// ============================================================================

function parseMixedNumber(input: string): number | null {
  const normalized = input
    .replace(/\u00BC/g, '1/4')
    .replace(/\u00BD/g, '1/2')
    .replace(/\u00BE/g, '3/4')
    .trim()

  const mixed = normalized.match(/^(\d+)\s*[- ]\s*(\d+)\/(\d+)$/)
  if (mixed) {
    const whole = Number.parseInt(mixed[1], 10)
    const numerator = Number.parseInt(mixed[2], 10)
    const denominator = Number.parseInt(mixed[3], 10)
    if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return whole + (numerator / denominator)
    }
  }

  const fraction = normalized.match(/^(\d+)\/(\d+)$/)
  if (fraction) {
    const numerator = Number.parseInt(fraction[1], 10)
    const denominator = Number.parseInt(fraction[2], 10)
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return numerator / denominator
    }
  }

  const decimal = Number.parseFloat(normalized)
  if (Number.isFinite(decimal)) {
    return decimal
  }

  return null
}

function formatDecimal(value: number, maxDecimals: number): string {
  const fixed = value.toFixed(maxDecimals)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function formatOunces(value: number): string {
  return `${formatDecimal(value, 3)}oz`
}

function formatInches(value: number): string {
  return `${formatDecimal(value, 3)}in`
}

export function extractShotSize(productName: string): string | null {
  const name = productName.toLowerCase()

  const buckMatch = name.match(/(?:^|\s)(?:#|no\.?\s*)?(0{1,3}|[1-9](?:\.5)?)\s*(?:buck(?:shot)?)\b/i)
  if (buckMatch) {
    return `${buckMatch[1]} Buck`
  }

  const shotMatch = name.match(/(?:^|\s)(?:#|no\.?\s*|number\s*)?([1-9](?:\.5)?)\s*(?:shot|birdshot)\b/i)
  if (shotMatch) {
    return `${shotMatch[1]} Shot`
  }

  return null
}

export function extractSlugWeight(productName: string): string | null {
  if (!/slug/i.test(productName)) return null
  const match = productName.match(/(\d+(?:\.\d+)?|\d+\s*[- ]\s*\d+\/\d+)\s?oz\b/i)
  if (!match) return null

  const parsed = parseMixedNumber(match[1])
  if (parsed == null) return null
  return formatOunces(parsed)
}

function extractShotWeight(productName: string): string | null {
  if (/slug/i.test(productName) || !/buck|shot/i.test(productName)) return null
  const match = productName.match(/(\d+(?:\.\d+)?|\d+\s*[- ]\s*\d+\/\d+)\s?oz\b/i)
  if (!match) return null

  const parsed = parseMixedNumber(match[1])
  if (parsed == null) return null
  return formatOunces(parsed)
}

export function extractShellLength(productName: string): string | null {
  const match = productName.match(/(?<![/\d])(\d+(?:\.\d+)?|\d+\s*[- ]\s*\d+\/\d+)\s*(?:in(?:ch)?|")/i)
  if (!match) return null

  const parsed = parseMixedNumber(match[1])
  if (parsed == null) return null
  return formatInches(parsed)
}

export function deriveShotgunLoadType(
  productName: string,
  shotSize?: string | null,
  slugWeight?: string | null
): string | null {
  const resolvedShotSize = shotSize ?? extractShotSize(productName)
  if (resolvedShotSize) return resolvedShotSize

  const resolvedSlugWeight = slugWeight ?? extractSlugWeight(productName)
  if (resolvedSlugWeight) return `${resolvedSlugWeight} Slug`

  if (/\bslug\b/i.test(productName)) {
    return 'Slug'
  }

  const shotWeight = extractShotWeight(productName)
  if (shotWeight) {
    return /buck/i.test(productName) ? `${shotWeight} Buck` : `${shotWeight} Shot`
  }

  // Less-lethal / specialty loads: "1 Ball Rubber", "2 Ball", "Bean Bag", etc.
  const ballMatch = productName.match(/\b(\d+)\s*ball(?:\s*(rubber|lead))?\b/i)
  if (ballMatch) {
    const count = ballMatch[1]
    const material = ballMatch[2] ? ` ${ballMatch[2].charAt(0).toUpperCase()}${ballMatch[2].slice(1).toLowerCase()}` : ''
    return `${count} Ball${material}`
  }

  // Bean bag rounds
  if (/\bbean\s*bag\b/i.test(productName)) {
    return 'Bean Bag'
  }

  // Rubber buckshot - handles various orderings:
  // "Rubber Buckshot", "Rubber Buck Shot", "Rubber 12 Gauge Buck Shot"
  if (/\brubber\b/i.test(productName) && /\bbuck\s*shot\b/i.test(productName)) {
    return 'Rubber Buck'
  }
  // Adjacent "Rubber Buck" without "shot"
  if (/\brubber\s*buck\b/i.test(productName)) {
    return 'Rubber Buck'
  }

  // Generic buckshot/shot fallback when size/weight is missing.
  if (/\bbuck\s*shot\b/i.test(productName)) {
    return 'Buckshot'
  }
  if (/\bshot\b/i.test(productName)) {
    return 'Shot'
  }

  return null
}

// ============================================================================
// COMPREHENSIVE NORMALIZATION
// ============================================================================

export interface NormalizedAmmo {
  productId: string
  name: string
  caliber: string | null
  grainWeight: number | null
  caseMaterial: CaseMaterial
  purpose: AmmoPurpose
  roundCount: number | null
  upc: string | null
  brand: string | null
}

export function normalizeAmmoProduct(product: {
  name: string
  upc?: string | null
  brand?: string | null
}): NormalizedAmmo {
  const caliber = extractCaliber(product.name)
  const grainWeight = extractGrainWeight(product.name)
  const caseMaterial = extractCaseMaterial(product.name)
  const purpose = classifyPurpose(product.name)
  const roundCount = extractRoundCount(product.name)
  const upc = product.upc || null
  const brand = product.brand || null

  const productId = generateProductId({
    upc,
    name: product.name,
    caliber,
    grainWeight,
    brand,
  })

  return {
    productId,
    name: product.name,
    caliber,
    grainWeight,
    caseMaterial,
    purpose,
    roundCount,
    upc,
    brand,
  }
}
