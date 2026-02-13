'use client'

import * as React from 'react'
import { IronScoutLogo } from './iron-scout-logo'

/**
 * Props for MarketingHeader component.
 */
export interface MarketingHeaderProps {
  /** Current active page for highlighting */
  currentPage?: 'home' | 'search' | 'calibers' | 'price-check' | 'about' | 'retailers' | 'privacy' | 'terms' | 'signin' | 'signup'
  /** Base URL for the marketing website (www) */
  websiteUrl: string
  /** Base URL for the web app */
  appUrl: string
}

/**
 * Shared marketing header component used across www, web, and other apps.
 * Provides consistent navigation and branding across all IronScout properties.
 * Includes responsive hamburger menu for mobile.
 */
export function MarketingHeader({ currentPage, websiteUrl, appUrl }: MarketingHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const isSignIn = currentPage === 'signin'
  const isSignUp = currentPage === 'signup'

  // Close menu on resize to desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navLinks = [
    { href: `${appUrl}/search`, label: 'Search', page: 'search' as const, alwaysVisible: false },
    { href: `${websiteUrl}/calibers`, label: 'Calibers', page: 'calibers' as const, alwaysVisible: false },
    { href: `${appUrl}/price-check`, label: 'In-Store Price Check', page: 'price-check' as const, alwaysVisible: false },
    { href: `${websiteUrl}/about`, label: 'About', page: 'about' as const, alwaysVisible: false },
    { href: `${websiteUrl}/retailers`, label: 'For Retailers', page: 'retailers' as const, alwaysVisible: false },
  ]

  return (
    <header className="sticky top-0 z-50 w-full bg-iron-950/80 backdrop-blur-md">
      {/* Early Access Banner */}
      <div className="border-b border-primary/20 bg-primary/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-center text-sm text-iron-200">
          <span className="font-bold text-primary">Early Access</span>
          <span className="mx-1.5 text-iron-600">&mdash;</span>
          We&apos;re in launch testing. Retailer coverage is expanding&nbsp;&mdash; check back as selection grows.
        </div>
      </div>
      <div className="border-b border-iron-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href={websiteUrl} className="flex items-center gap-2 flex-shrink-0">
            <IronScoutLogo className="w-8 h-8" />
            <span className="font-display text-xl font-semibold tracking-tight">
              Iron<span className="text-primary">Scout</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4 sm:gap-6">
            {navLinks.map((link) => (
              <a
                key={link.page}
                href={link.href}
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  currentPage === link.page ? 'text-white' : 'text-iron-400 hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href={`${appUrl}/auth/signin`}
              className={`text-sm font-medium transition-colors ${
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

          {/* Mobile: Search + CTA + Hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <a
              href={`${appUrl}/search`}
              className={`text-sm font-medium transition-colors ${
                currentPage === 'search' ? 'text-white' : 'text-iron-400 hover:text-white'
              }`}
            >
              Search
            </a>
            <a
              href={`${appUrl}/auth/signup`}
              className={`text-sm py-1.5 px-4 ${
                isSignUp
                  ? 'btn-primary opacity-50 pointer-events-none'
                  : 'btn-primary'
              }`}
            >
              Get Started
            </a>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-iron-300 hover:text-white p-2 -mr-2"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-iron-800 py-4">
            <div className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.page}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    currentPage === link.page ? 'text-white' : 'text-iron-400 hover:text-white'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="border-t border-iron-800 my-1" />
              <a
                href={`${appUrl}/auth/signin`}
                className={`text-sm font-medium transition-colors ${
                  isSignIn ? 'text-iron-600 pointer-events-none' : 'text-iron-300 hover:text-white'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Sign In
              </a>
            </div>
          </div>
        )}
      </div>
      </div>
    </header>
  )
}
