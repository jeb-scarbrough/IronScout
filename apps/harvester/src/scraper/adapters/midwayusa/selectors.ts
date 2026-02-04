/**
 * MidwayUSA Selectors
 *
 * MidwayUSA uses JSON-LD structured data for product information.
 * CSS selectors are not the primary extraction method for this adapter.
 * This file is kept for consistency with the adapter template.
 */

export const SELECTORS = {
  jsonLd: 'script[type="application/ld+json"]',
} as const
