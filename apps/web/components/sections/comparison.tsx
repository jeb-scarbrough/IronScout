import { Layers, TrendingDown, BarChart3 } from 'lucide-react'

const benefits = [
  {
    icon: Layers,
    text: 'Cleanly grouped products',
  },
  {
    icon: BarChart3,
    text: 'How today\'s price compares to recent history',
  },
  {
    icon: TrendingDown,
    text: 'Whether a price looks typical or unusually low',
  },
]

export function Comparison() {
  return (
    <section id="comparison" className="py-20 lg:py-28 bg-slate-50 dark:bg-gray-900/50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
            Why IronScout Is Different
          </h2>

          <div className="text-center mb-10">
            <p className="text-lg text-muted-foreground mb-4">
              Most deal sites only show the lowest price <em>right now</em>.
            </p>
            <p className="text-xl font-medium text-foreground">
              IronScout adds context.
            </p>
          </div>

          <p className="text-lg text-muted-foreground text-center mb-8">
            Instead of scrolling through inconsistent listings, you see:
          </p>

          <div className="space-y-4 mb-10">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <benefit.icon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-lg text-foreground">
                  {benefit.text}
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-lg text-muted-foreground">
            That context helps you decide when to buy — without claiming to decide for you.
          </p>
        </div>
      </div>
    </section>
  )
}
