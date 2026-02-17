/**
 * Brand configuration for the www (marketing) site.
 * URLs are configurable via environment variables for local development.
 */

// URL for the main web application (app.ironscout.ai in production)
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

const APP_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.ironscout.ai'
)

// URL for the marketing website (www.ironscout.ai in production)
const WWW_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_WWW_URL || 'https://www.ironscout.ai'
)

export const BRAND = {
  name: 'IronScout',
  domain: 'IronScout.ai',
  tagline: 'AI-Powered Ammo Search',
  appUrl: APP_URL,
  wwwUrl: WWW_URL,
  description: 'Intent-aware ammunition search and price comparison',
} as const

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
