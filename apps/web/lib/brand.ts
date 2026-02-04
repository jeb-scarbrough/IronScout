/**
 * Centralized brand constants for IronScout
 *
 * Use BRAND.name for in-product display (sidebar, headers, titles)
 * Use BRAND.domain for external/marketing contexts only
 */

/** WWW site URL - uses NEXT_PUBLIC_WWW_URL env var for local dev */
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL || 'https://www.ironscout.ai'

/** APP site URL - uses NEXT_PUBLIC_APP_URL env var for local dev */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ironscout.ai'

export const BRAND = {
  /** Primary brand name for in-product usage */
  name: 'IronScout',
  /** Full domain form - use only for external/marketing contexts */
  domain: 'IronScout.ai',
  /** Product tagline */
  tagline: 'AI-Powered Ammo Search',
  /** Official website URL (www) */
  website: WWW_URL,
  /** App URL (app) */
  appUrl: APP_URL,
  /** Short description */
  description: 'Intent-aware ammunition search and price comparison',
} as const

/** Convenience export for common usage */
export const BRAND_NAME = BRAND.name

// Log brand configuration on startup (client-side only, in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log(
    '%c[BRAND CONFIG]%c APP_URL=%c%s%c WWW_URL=%c%s',
    'background: #f59e0b; color: black; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
    'color: inherit;',
    'color: #22c55e; font-weight: bold;',
    APP_URL,
    'color: inherit;',
    'color: #22c55e; font-weight: bold;',
    WWW_URL
  )
}
