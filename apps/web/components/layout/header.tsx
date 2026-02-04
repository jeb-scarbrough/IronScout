'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Menu, X, User, Bookmark, Settings, LayoutDashboard, ChevronDown, Search, LogOut } from 'lucide-react'
import { IronScoutLogo } from '@ironscout/ui/components'
import { BRAND } from '@/lib/brand'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()

  // Don't render main header on pages that use MarketingHeader
  if (pathname?.startsWith('/auth') || pathname === '/price-check') {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-iron-800/50 bg-iron-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - links to www home page */}
          <a href={BRAND.website} className="flex items-center gap-2">
            <IronScoutLogo className="w-8 h-8" />
            <span className="font-display text-xl font-semibold tracking-tight">
              Iron<span className="text-primary">Scout</span>
            </span>
          </a>

          {/* Desktop Navigation - matches www header exactly */}
          <nav className="hidden md:flex items-center gap-4 sm:gap-6">
            <Link href="/price-check" className="text-iron-400 hover:text-white text-sm font-medium transition-colors">
              Price Check
            </Link>
            <a
              href={`${BRAND.website}/about`}
              className="text-iron-400 hover:text-white text-sm font-medium transition-colors"
            >
              About
            </a>
            <a
              href={`${BRAND.website}/retailers`}
              className="text-iron-400 hover:text-white text-sm font-medium transition-colors"
            >
              For Retailers
            </a>
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 text-iron-300 hover:text-white text-sm font-medium transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span>{session.user?.name?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-iron-900 border border-iron-800 z-50">
                      <div className="py-1">
                        <Link
                          href="/dashboard"
                          className="flex items-center px-4 py-2 text-sm text-iron-300 hover:bg-iron-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <LayoutDashboard className="h-4 w-4 mr-3" />
                          Dashboard
                        </Link>
                        <Link
                          href="/search"
                          className="flex items-center px-4 py-2 text-sm text-iron-300 hover:bg-iron-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Search className="h-4 w-4 mr-3" />
                          Search
                        </Link>
                        <Link
                          href="/dashboard/saved"
                          className="flex items-center px-4 py-2 text-sm text-iron-300 hover:bg-iron-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Bookmark className="h-4 w-4 mr-3" />
                          Saved Items
                        </Link>
                        <Link
                          href="/dashboard/settings"
                          className="flex items-center px-4 py-2 text-sm text-iron-300 hover:bg-iron-800 hover:text-white"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Settings className="h-4 w-4 mr-3" />
                          Settings
                        </Link>
                        <div className="border-t border-iron-800 my-1"></div>
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false)
                            signOut({ callbackUrl: '/' })
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-iron-300 hover:bg-iron-800 hover:text-white text-left"
                        >
                          <LogOut className="h-4 w-4 mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-iron-300 hover:text-white text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="btn-primary text-sm py-2"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-iron-300 hover:text-white p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Navigation - matches www header */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-iron-800 py-4">
            <nav className="flex flex-col space-y-4">
              <Link
                href="/price-check"
                className="text-sm font-medium text-iron-400 hover:text-white transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Price Check
              </Link>
              <a
                href={`${BRAND.website}/about`}
                className="text-sm font-medium text-iron-400 hover:text-white transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </a>
              <a
                href={`${BRAND.website}/retailers`}
                className="text-sm font-medium text-iron-400 hover:text-white transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                For Retailers
              </a>
              {session ? (
                <>
                  <div className="border-t border-iron-800 my-2"></div>
                  <Link
                    href="/dashboard"
                    className="flex items-center text-sm font-medium text-iron-400 hover:text-white transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Link>
                  <Link
                    href="/search"
                    className="flex items-center text-sm font-medium text-iron-400 hover:text-white transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Link>
                  <Link
                    href="/dashboard/saved"
                    className="flex items-center text-sm font-medium text-iron-400 hover:text-white transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Bookmark className="h-4 w-4 mr-2" />
                    Saved Items
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center text-sm font-medium text-iron-400 hover:text-white transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                  <div className="border-t border-iron-800 my-2"></div>
                  <button
                    onClick={() => {
                      signOut({ callbackUrl: '/' })
                      setIsMenuOpen(false)
                    }}
                    className="flex items-center text-sm font-medium text-iron-400 hover:text-white transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <div className="border-t border-iron-800 my-2"></div>
                  <Link
                    href="/auth/signin"
                    className="text-sm font-medium text-iron-300 hover:text-white transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="btn-primary text-sm py-2 w-fit"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
