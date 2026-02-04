import Link from 'next/link'
import { AlertTriangle, ShieldAlert, ShieldX, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

export type BrandedErrorAction = {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
}

type BrandedErrorCardProps = {
  code?: string
  title: string
  description: string
  steps?: string[]
  actions?: BrandedErrorAction[]
  tone?: 'warning' | 'access' | 'maintenance'
  details?: string
  className?: string
}

const toneIcon = {
  warning: AlertTriangle,
  access: ShieldX,
  maintenance: Wrench,
}

export function BrandedErrorCard({
  code,
  title,
  description,
  steps,
  actions,
  tone = 'warning',
  details,
  className,
}: BrandedErrorCardProps) {
  const Icon = toneIcon[tone] ?? ShieldAlert

  return (
    <section className={cn('mx-auto w-full max-w-3xl px-6 py-10', className)}>
      <div className="rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-6 p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-muted p-3">
              <Icon className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {code ? (
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    {code}
                  </span>
                ) : null}
                <span className="text-xs font-medium text-muted-foreground">
                  {BRAND.name}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {steps && steps.length > 0 ? (
            <div className="rounded-xl border border-border/50 bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What you can do
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {steps.map((step) => (
                  <li key={step} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {details ? (
            <div className="rounded-xl border border-border/50 bg-muted/40 p-4 text-xs text-muted-foreground">
              {details}
            </div>
          ) : null}

          {actions && actions.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {actions.map((action) => {
                const variant = action.variant ?? 'default'
                if (action.href) {
                  return (
                    <Button key={`${action.label}-${action.href}`} asChild variant={variant}>
                      <Link href={action.href}>{action.label}</Link>
                    </Button>
                  )
                }
                return (
                  <Button
                    key={action.label}
                    variant={variant}
                    onClick={action.onClick}
                    type="button"
                  >
                    {action.label}
                  </Button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
