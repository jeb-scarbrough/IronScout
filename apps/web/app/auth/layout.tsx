'use client'

import { usePathname } from 'next/navigation'
import { MarketingHeader } from '@ironscout/ui/components/marketing-header'
import { BRAND } from '@/lib/brand'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentPage = pathname === '/auth/signup' ? 'signup' : 'signin'

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
