'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { BRAND } from '@/lib/brand'

const WWW_URL = BRAND.website

// Force dark theme for auth pages to match www site
function useForceAuthTheme() {
  const { setTheme, theme } = useTheme()

  useEffect(() => {
    // Store original theme and force dark
    const originalTheme = theme
    setTheme('dark')

    // Note: We don't restore on unmount because user will navigate
    // to dashboard which should respect their preference
  }, [setTheme])
}

function AuthHeader() {
  const pathname = usePathname()
  const isSignUp = pathname === '/auth/signup'
  const isSignIn = pathname === '/auth/signin'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href={WWW_URL} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">
              Iron<span className="text-primary">Scout</span>
            </span>
          </a>

          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/price-check"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Price Check
            </Link>
            <a
              href={`${WWW_URL}/about`}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors hidden sm:block"
            >
              About
            </a>
            <a
              href={`${WWW_URL}/retailers`}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors hidden sm:block"
            >
              For Retailers
            </a>
            {!isSignIn && (
              <Link
                href="/auth/signin"
                className="text-foreground/80 hover:text-foreground text-sm font-medium transition-colors hidden sm:block"
              >
                Sign In
              </Link>
            )}
            {!isSignUp && (
              <Link
                href="/auth/signup"
                className="btn-primary text-sm py-2"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Force dark theme for auth pages to match www marketing site
  useForceAuthTheme()

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="noise-overlay" />
      <AuthHeader />
      <div className="pt-16">
        {children}
      </div>
    </div>
  )
}
