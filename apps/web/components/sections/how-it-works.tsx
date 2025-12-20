import { Search, Layers, Filter } from 'lucide-react'

const capabilities = [
  {
    icon: Search,
    text: 'Search by caliber, grain, bullet type, and use case',
  },
  {
    icon: Layers,
    text: 'See equivalent products grouped together',
  },
  {
    icon: Filter,
    text: 'Spend less time filtering noise and more time evaluating options',
  },
]

export function HowItWorks() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
            AI-Powered Search (Built for Ammo)
          </h2>

          <p className="text-lg text-muted-foreground text-center mb-10">
            Ammo listings are inconsistent. Specs are buried. Names don't match.
            <br />
            IronScout uses AI to normalize and understand listings so you can:
          </p>

          <div className="space-y-4 mb-10">
            {capabilities.map((capability, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-gray-800/50"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <capability.icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-lg text-foreground">
                  {capability.text}
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-lg text-muted-foreground">
            AI assists discovery and ranking. Final buying decisions are always yours.
          </p>
        </div>
      </div>
    </section>
  )
}
