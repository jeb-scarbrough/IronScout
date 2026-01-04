'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'
import { PWAInstallPrompt } from '@/components/pwa'
import { ServiceWorkerProvider } from '@/lib/service-worker'
import { useSessionRefresh } from '@/hooks/use-session-refresh'

// Workaround for next-themes React 19 compatibility
// See: https://github.com/pacocoursey/next-themes/issues/367
function ThemeProvider({ children, ...props }: ThemeProviderProps & { children: React.ReactNode }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// Component that monitors session for token refresh errors
function SessionRefreshHandler({ children }: { children: React.ReactNode }) {
  useSessionRefresh()
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionRefreshHandler>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ServiceWorkerProvider>
            {children}
            <PWAInstallPrompt />
          </ServiceWorkerProvider>
        </ThemeProvider>
      </SessionRefreshHandler>
    </SessionProvider>
  )
}
