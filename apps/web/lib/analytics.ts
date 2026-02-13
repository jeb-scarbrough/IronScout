/**
 * Analytics Event Tracking
 *
 * Centralized analytics utility for tracking user interactions.
 * Events are structured for easy consumption by analytics platforms.
 */

import { createLogger } from './logger'

const logger = createLogger('analytics')

export type AnalyticsEvent =
  | RetailerClickEvent
  | TrackToggleEvent
  | DetailsToggleEvent

export interface RetailerClickEvent {
  event: 'retailer_click'
  retailer: string
  product_id?: string
  placement?: string
  destination_domain?: string
  search_query?: string
  result_rank?: number
  results_count?: number
  caliber?: string
  category?: string
  price_total?: number
  price_per_round?: number
  in_stock?: boolean
}

export interface TrackToggleEvent {
  event: 'track_toggle'
  id: string
  nextState: boolean
}

export interface DetailsToggleEvent {
  event: 'details_toggle'
  id: string
  expanded: boolean
}

/**
 * Track an analytics event
 *
 * Currently logs to console in development.
 * Extend this function to integrate with your analytics platform
 * (Google Analytics, PostHog, Amplitude, etc.)
 */
export function trackEvent(event: AnalyticsEvent): void {
  // Development logging
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Track event', { event })
  }

  // Analytics provider calls are wrapped in try/catch per spec:
  // "Must not throw if analytics is unavailable or disabled."

  // Google Analytics 4 integration (if available)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    try {
      const { event: eventName, ...params } = event
      ;(window as any).gtag('event', eventName, params)
    } catch { /* best-effort */ }
  }

  // PostHog integration (if available)
  if (typeof window !== 'undefined' && (window as any).posthog) {
    try {
      const { event: eventName, ...params } = event
      ;(window as any).posthog.capture(eventName, params)
    } catch { /* best-effort */ }
  }

  // Datadog RUM integration (if available)
  if (typeof window !== 'undefined' && (window as any).DD_RUM) {
    try {
      const { event: eventName, ...params } = event
      ;(window as any).DD_RUM.addAction(eventName, params)
    } catch { /* best-effort */ }
  }
}

/**
 * Track retailer click event (outbound link)
 *
 * Best-effort, no-throw. Fires GA4 retailer_click event.
 */
export function trackRetailerClick(
  params: Omit<RetailerClickEvent, 'event'>
): void {
  trackEvent({
    event: 'retailer_click',
    ...params,
  })
}

/**
 * Extract domain from a URL string (best-effort, no-throw)
 */
export function extractDomain(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/**
 * Track price tracking toggle
 */
export function trackTrackToggle(id: string, nextState: boolean): void {
  trackEvent({
    event: 'track_toggle',
    id,
    nextState,
  })
}

/**
 * Track details expansion toggle
 */
export function trackDetailsToggle(id: string, expanded: boolean): void {
  trackEvent({
    event: 'details_toggle',
    id,
    expanded,
  })
}
