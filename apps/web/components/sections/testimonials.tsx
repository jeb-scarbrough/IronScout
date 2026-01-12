import { Check } from 'lucide-react'

const features = [
  'Intent-aware ammo search',
  'Current best prices',
  'Price history charts',
  'Alerts for price drops and stock changes',
  'Advanced filters and ranking',
  'AI-assisted explanations for context',
]

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-slate-50 dark:bg-gray-900/50">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
            What You Get
          </h2>

          <div className="text-center mb-12">
            <p className="text-lg text-foreground">
              <strong>All users have the same capabilities during v1.</strong>
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <ul className="space-y-3">
              {features.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
