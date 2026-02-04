import Link from 'next/link'
import { BrandedErrorCard } from '@/components/errors/branded-error-card'
import { Button } from '@/components/ui/button'

const ERROR_COPY: Record<string, { title: string; description: string; steps: string[] }> = {
  AccessDenied: {
    title: 'Access denied',
    description: 'This account is not authorized to sign in.',
    steps: [
      'Try a different account.',
      'If you believe this is a mistake, contact support.',
      'Return to the sign-in page to continue.',
    ],
  },
  OAuthAccountNotLinked: {
    title: 'Account already exists',
    description: 'This email is linked to a different sign-in method.',
    steps: [
      'Use the sign-in method you originally used.',
      'If you no longer have access, contact support.',
    ],
  },
  Configuration: {
    title: 'Sign-in is temporarily unavailable',
    description: 'A configuration issue is blocking sign-in for now.',
    steps: [
      'Try again in a few minutes.',
      'If the issue persists, contact support.',
    ],
  },
  Verification: {
    title: 'Sign-in verification failed',
    description: 'We couldn’t complete the verification step.',
    steps: [
      'Try signing in again.',
      'Check that your browser allows cookies.',
    ],
  },
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorKey = searchParams.error || 'AccessDenied'
  const config = ERROR_COPY[errorKey] ?? {
    title: 'Sign-in error',
    description: 'We couldn’t complete the sign-in request.',
    steps: [
      'Try again using the sign-in page.',
      'If the issue continues, contact support.',
    ],
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <BrandedErrorCard
        code="AUTH"
        title={config.title}
        description={config.description}
        steps={config.steps}
        tone="access"
        actions={[
          { label: 'Back to sign in', href: '/auth/signin' },
          { label: 'Go to home', href: '/', variant: 'outline' },
        ]}
      />
      <div className="sr-only">
        <Button asChild>
          <Link href="/auth/signin">Sign in</Link>
        </Button>
      </div>
    </div>
  )
}
