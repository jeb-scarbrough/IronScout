'use client'

import { Sparkles } from 'lucide-react'

export function PricingHeader() {
  return (
    <div className="text-center mb-12">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-6">
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          AI-Powered Ammo Search
        </span>
      </div>
      
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        Smarter Ammo Decisions,{' '}
        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Powered by AI
        </span>
      </h1>
      
      <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
        Whether you're new to shooting or know exactly what you want, IronScout helps you 
        find the right ammo for your purpose—fast.
      </p>
      
      <p className="text-muted-foreground">
        Compare plans and choose what works best for you.
      </p>
    </div>
  )
}
