'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { BRAND, BRAND_NAME } from '@/lib/brand'

const WWW_URL = BRAND.website

function AuthHeader() {
  const pathname = usePathname()
  const isSignUp = pathname === '/auth/signup'
  const isSignIn = pathname === '/auth/signin'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/logo-dark.svg"
              alt="IronScout"
              width={24}
              height={24}
              className="flex-shrink-0"
            />
            <span className="text-xl font-bold">{BRAND_NAME}</span>
          </Link>

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
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors hidden sm:block"
              >
                Sign In
              </Link>
            )}
            {!isSignUp && (
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded transition-colors"
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
  return (
    <>
      <AuthHeader />
      <div className="pt-16">
        {children}
      </div>
    </>
  )
}
