import Link from 'next/link'

const WWW_URL = 'https://ironscout.ai'

function AuthHeader() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight">
              Iron<span className="text-primary">Scout</span>
            </span>
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
            <Link
              href="/auth/signin"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
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
      <main className="pt-16">
        {children}
      </main>
    </>
  )
}
