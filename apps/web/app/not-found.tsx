import { BrandedErrorCard } from '@/components/errors/branded-error-card'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <BrandedErrorCard
        code="404"
        title="We can’t find that page"
        description="The link may be outdated, or the page was moved."
        steps={[
          'Check the URL for typos.',
          'Use search to find the product or category you want.',
          'Head back to the homepage and navigate from there.',
        ]}
        actions={[
          { label: 'Go to search', href: '/search' },
          { label: 'Go to home', href: '/', variant: 'outline' },
        ]}
        tone="warning"
      />
    </div>
  )
}
