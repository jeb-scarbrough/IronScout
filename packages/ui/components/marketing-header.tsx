'use client'

import * as React from 'react'
import { IronScoutLogo } from './iron-scout-logo'

/**
 * Props for MarketingHeader component.
 *
 * Brand URLs should be passed in from the consuming app's environment/config
 * to support different environments (local, staging, production).
 */
export interface MarketingHeaderProps {
  /** Current active page for highlighting */
  currentPage?: 'home' | 'price-check' | 'about' | 'retailers' | 'privacy' | 'terms' | 'signin' | 'signup'
  /** Base URL for the marketing website (www) */
  websiteUrl: string
  /** Base URL for the web app */
  appUrl: string
}

/**
 * Shared marketing header component used across www, web, and other apps.
 * Provides consistent navigation and branding across all IronScout properties.
 *
 * Usage:
 * ```tsx
 * import { MarketingHeader } from '@ironscout/ui/components/marketing-header'
 *
 * <MarketingHeader
 *   currentPage="about"
 *   websiteUrl={BRAND.website}
 *   appUrl={BRAND.appUrl}
 * />
 * ```
 */
export function MarketingHeader({ currentPage, websiteUrl, appUrl }: MarketingHeaderProps) {
  const isSignIn = currentPage === 'signin'
  const isSignUp = currentPage === 'signup'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-iron-950/80 backdrop-blur-md border-b border-iron-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href={websiteUrl} className="flex items-center gap-2">
            <IronScoutLogo className="w-8 h-8" />
            <span className="font-display text-xl font-semibold tracking-tight">
              Iron<span className="text-primary">Scout</span>
            </span>
          </a>

          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href={`${appUrl}/price-check`}
              className={`text-sm font-medium transition-colors ${
                currentPage === 'price-check' ? 'text-white' : 'text-iron-400 hover:text-white'
              }`}
            >
              In-Store Price Check
            </a>
            <a
              href={`${websiteUrl}/about`}
              className={`text-sm font-medium transition-colors hidden sm:block ${
                currentPage === 'about' ? 'text-white' : 'text-iron-400 hover:text-white'
              }`}
            >
              About
            </a>
            <a
              href={`${websiteUrl}/retailers`}
              className={`text-sm font-medium transition-colors hidden sm:block ${
                currentPage === 'retailers' ? 'text-white' : 'text-iron-400 hover:text-white'
              }`}
            >
              For Retailers
            </a>
            <a
              href={`${appUrl}/auth/signin`}
              className={`text-sm font-medium transition-colors hidden sm:block ${
                isSignIn
                  ? 'text-iron-600 pointer-events-none'
                  : 'text-iron-300 hover:text-white'
              }`}
            >
              Sign In
            </a>
            <a
              href={`${appUrl}/auth/signup`}
              className={`text-sm py-2 ${
                isSignUp
                  ? 'btn-primary opacity-50 pointer-events-none'
                  : 'btn-primary'
              }`}
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
