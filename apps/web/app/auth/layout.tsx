'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BRAND } from '@/lib/brand'

const WWW_URL = BRAND.website

function AuthHeader() {
  const pathname = usePathname()
  const isSignUp = pathname === '/auth/signup'
  const isSignIn = pathname === '/auth/signin'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href={WWW_URL} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight">
              Iron<span className="text-primary">Scout</span>
            </span>
          </a>

          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/price-check"
              className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
            >
              Price Check
            </Link>
            <a
              href={`${WWW_URL}/about`}
              className="text-zinc-400 hover:text-white text-sm font-medium transition-colors hidden sm:block"
            >
              About
            </a>
            <a
              href={`${WWW_URL}/retailers`}
              className="text-zinc-400 hover:text-white text-sm font-medium transition-colors hidden sm:block"
            >
              For Retailers
            </a>
            {!isSignIn && (
              <Link
                href="/auth/signin"
                className="text-zinc-300 hover:text-white text-sm font-medium transition-colors hidden sm:block"
              >
                Sign In
              </Link>
            )}
            {!isSignUp && (
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/80 text-zinc-950 text-sm font-medium rounded-lg transition-colors"
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
