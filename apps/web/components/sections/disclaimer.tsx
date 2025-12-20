import { AlertCircle } from 'lucide-react'

export function Disclaimer() {
  return (
    <section className="py-12 bg-slate-100 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>Important Note:</strong> Prices and availability change frequently.
            IronScout provides market data, trends, and signals — not guarantees.
          </p>
        </div>
      </div>
    </section>
  )
}
