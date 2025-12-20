import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TrendingUp, BarChart3, Eye, ArrowRight } from 'lucide-react'

const audiences = [
  {
    icon: TrendingUp,
    text: 'Care about price trends, not just one-off deals',
  },
  {
    icon: BarChart3,
    text: 'Want to avoid overpaying when prices spike',
  },
  {
    icon: Eye,
    text: 'Prefer insight and context over hype',
  },
]

export function CTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
            Built for How People Actually Buy Ammo
          </h2>

          <p className="text-lg text-muted-foreground text-center mb-10">
            IronScout is designed for shooters who:
          </p>

          <div className="space-y-4 mb-10">
            {audiences.map((audience, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-gray-800/50"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <audience.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-lg text-foreground">
                  {audience.text}
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-lg text-muted-foreground mb-10">
            Whether you buy occasionally or track the market closely, IronScout helps you stay informed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                <TrendingUp className="mr-2 h-4 w-4" />
                Start Tracking Prices
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/search">
                Explore Current Deals
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
