'use client'

import { useEffect } from 'react'
import { BrandedErrorCard } from '@/components/errors/branded-error-card'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log for client-side visibility; server logs are handled elsewhere.
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <BrandedErrorCard
        code="500"
        title="Something went wrong on our side"
        description="We couldn’t complete that request. The issue may be temporary."
        steps={[
          'Try the action again in a few seconds.',
          'If the problem persists, sign out and sign back in.',
          'Contact support and include the error ID below.',
        ]}
        details={error.digest ? `Error ID: ${error.digest}` : undefined}
        actions={[
          { label: 'Try again', onClick: reset },
          { label: 'Go to home', href: '/', variant: 'outline' },
        ]}
        tone="maintenance"
      />
    </div>
  )
}
