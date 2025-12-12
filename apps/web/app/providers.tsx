'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { PWAInstallPrompt } from '@/components/pwa'
import { ServiceWorkerProvider } from '@/lib/service-worker'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
    </SessionProvider>
  )
}
