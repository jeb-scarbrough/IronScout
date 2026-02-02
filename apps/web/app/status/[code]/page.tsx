import { notFound } from 'next/navigation'
import { BrandedErrorCard } from '@/components/errors/branded-error-card'

const STATUS_MAP: Record<string, {
  title: string
  description: string
  steps: string[]
  tone?: 'warning' | 'access' | 'maintenance'
}> = {
  '401': {
    title: 'Sign-in required',
    description: 'You need an account to access this page.',
    steps: [
      'Sign in and try again.',
      'If you don’t have an account, create one first.',
      'If you already signed in, refresh the page.',
    ],
    tone: 'access',
  },
  '403': {
    title: 'Access denied',
    description: 'Your account doesn’t have permission to view this content.',
    steps: [
      'Make sure you’re signed in with the correct account.',
      'If you believe this is a mistake, contact support.',
      'Return to the homepage to continue browsing.',
    ],
    tone: 'access',
  },
  '404': {
    title: 'We can’t find that page',
    description: 'The link may be outdated, or the page was moved.',
    steps: [
      'Check the URL for typos.',
      'Use search to find the product or category you want.',
      'Return to the homepage and try again.',
    ],
    tone: 'warning',
  },
  '429': {
    title: 'Too many requests',
    description: 'We received too many requests from this browser.',
    steps: [
      'Wait a minute and try again.',
      'Avoid refreshing rapidly.',
      'If you’re using automation, slow the request rate.',
    ],
    tone: 'warning',
  },
  '500': {
    title: 'Something went wrong',
    description: 'We couldn’t complete that request.',
    steps: [
      'Try the action again in a few seconds.',
      'If the problem persists, sign out and sign back in.',
      'Contact support if it keeps happening.',
    ],
    tone: 'maintenance',
  },
  '501': {
    title: 'Not implemented',
    description: 'That feature isn’t available yet.',
    steps: [
      'Try a different route or action.',
      'Check back later for updates.',
      'Return to the homepage to continue browsing.',
    ],
    tone: 'warning',
  },
  '502': {
    title: 'Temporary upstream error',
    description: 'A dependent service is not responding.',
    steps: [
      'Wait a moment and try again.',
      'If the issue persists, contact support.',
      'Return to the homepage to continue browsing.',
    ],
    tone: 'maintenance',
  },
  '503': {
    title: 'Service unavailable',
    description: 'The service is temporarily unavailable.',
    steps: [
      'Wait a few minutes and try again.',
      'If this continues, contact support.',
      'Return to the homepage to continue browsing.',
    ],
    tone: 'maintenance',
  },
}

export default function StatusPage({ params }: { params: { code: string } }) {
  const config = STATUS_MAP[params.code]
  if (!config) {
    notFound()
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <BrandedErrorCard
        code={params.code}
        title={config.title}
        description={config.description}
        steps={config.steps}
        actions={[
          { label: 'Go to home', href: '/', variant: 'default' },
          { label: 'Go to search', href: '/search', variant: 'outline' },
        ]}
        tone={config.tone}
      />
    </div>
  )
}
