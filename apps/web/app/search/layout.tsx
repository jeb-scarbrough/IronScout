import { auth } from '@/lib/auth'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { SearchLoadingProvider } from '@/components/search/search-loading-context'
import { MarketingHeader } from '@ironscout/ui/components/marketing-header'
import { BRAND } from '@/lib/brand'

export default async function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // If not authenticated, show with MarketingHeader (consistent with price-check, auth pages)
  if (!session) {
    return (
      <SearchLoadingProvider>
        {/* Hide parent header and use MarketingHeader for consistency */}
        <style>{`
          body > div > header,
          body > div > footer {
            display: none !important;
          }
          body > div > main {
            flex: none !important;
          }
        `}</style>

        <div className="min-h-screen bg-background">
          <MarketingHeader
            currentPage="search"
            websiteUrl={BRAND.website}
            appUrl={BRAND.appUrl}
          />
          <main>
            {children}
          </main>
        </div>
      </SearchLoadingProvider>
    )
  }

  const userName = session.user?.name || session.user?.email || 'User'

  return (
    <SearchLoadingProvider>
      {/* Hide parent header/footer and take over the full viewport */}
      <style>{`
        body > div > header,
        body > div > footer {
          display: none !important;
        }
        body > div > main {
          flex: none !important;
        }
      `}</style>

      <div className="fixed inset-0 bg-background">
        <SidebarNav userName={userName} />

        {/* Main content area - offset for sidebar on desktop */}
        <div className="lg:pl-64 h-full overflow-auto">
          {/* Header spacer for mobile menu button */}
          <div className="lg:hidden h-16" />

          <main className="min-h-full">
            {children}
          </main>
        </div>
      </div>
    </SearchLoadingProvider>
  )
}
