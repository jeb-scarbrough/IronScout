'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BRAND, BRAND_NAME } from '@/lib/brand'

const WWW_URL = BRAND.website

export function Footer() {
  const pathname = usePathname()

  // Don't render footer on auth pages
  if (pathname?.startsWith('/auth')) {
    return null
  }

  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>&copy; {year} {BRAND_NAME}</span>
        <nav className="flex items-center gap-4">
          <a href={`${WWW_URL}/about`} className="hover:text-foreground transition-colors">About</a>
          <a href={`${WWW_URL}/retailers`} className="hover:text-foreground transition-colors">For Retailers</a>
          <a href={`${WWW_URL}/privacy`} className="hover:text-foreground transition-colors">Privacy</a>
          <a href={`${WWW_URL}/terms`} className="hover:text-foreground transition-colors">Terms</a>
        </nav>
      </div>
    </footer>
  )
}
