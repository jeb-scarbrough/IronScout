'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { MarketingHeader } from '@ironscout/ui/components/marketing-header'
import { BRAND } from '@/lib/brand'

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

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentPage = pathname === '/auth/signup' ? 'signup' : 'signin'

  // Force dark theme for auth pages to match www marketing site
  useForceAuthTheme()

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="noise-overlay" />
      <MarketingHeader
        currentPage={currentPage}
        websiteUrl={BRAND.website}
        appUrl={BRAND.appUrl}
      />
      <main className="pt-24">
        {children}
      </main>
    </div>
  )
}
