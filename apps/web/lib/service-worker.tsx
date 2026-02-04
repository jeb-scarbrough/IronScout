'use client'

import { useEffect } from 'react'
import { safeLogger } from './safe-logger'

export function useServiceWorker() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          safeLogger.components.info('Service Worker registered', { scope: registration.scope })

          // Check for updates periodically
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available, notify user
                  safeLogger.components.info('New content available, refresh to update')
                  // You could show a toast here prompting user to refresh
                }
              })
            }
          })
        })
        .catch((error) => {
          safeLogger.components.error('Service Worker registration failed', {}, error)
        })

      // Handle controller change (when new SW takes over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        safeLogger.components.info('New service worker activated')
      })
    }
  }, [])
}

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useServiceWorker()
  return <>{children}</>
}
