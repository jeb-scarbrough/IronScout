'use client';

import { BRAND } from '../../lib/brand';

const APP_URL = BRAND.appUrl;

interface HeaderProps {
  currentPage?: 'home' | 'about' | 'retailers' | 'privacy' | 'terms';
}

export function Header({ currentPage }: HeaderProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-iron-950/80 backdrop-blur-md border-b border-iron-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-iron-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">
              Iron<span className="text-primary">Scout</span>
            </span>
          </a>

          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href={`${APP_URL}/price-check`}
              className="text-iron-400 hover:text-white text-sm font-medium transition-colors"
            >
              Price Check
            </a>
            <a
              href="/about"
              className={`text-sm font-medium transition-colors hidden sm:block ${
                currentPage === 'about' ? 'text-white' : 'text-iron-400 hover:text-white'
              }`}
            >
              About
            </a>
            <a
              href="/retailers"
              className={`text-sm font-medium transition-colors hidden sm:block ${
                currentPage === 'retailers' ? 'text-white' : 'text-iron-400 hover:text-white'
              }`}
            >
              For Retailers
            </a>
            <a
              href={`${APP_URL}/auth/signin`}
              className="text-iron-300 hover:text-white text-sm font-medium transition-colors hidden sm:block"
            >
              Sign In
            </a>
            <a
              href={`${APP_URL}/auth/signup`}
              className="btn-primary text-sm py-2"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
