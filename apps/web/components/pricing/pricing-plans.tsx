'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Check, X, Sparkles, Zap, Shield, Target, TrendingUp } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createCheckoutSession } from '@/lib/api'

// Pricing configuration
const PRICING = {
  PREMIUM_MONTHLY: 4.99,
  PREMIUM_ANNUAL: 49.99,
  PREMIUM_ANNUAL_MONTHLY: 4.17,
  SAVINGS_PERCENT: 17,
}

// Feature comparison data
const featureComparison = [
  { 
    category: 'Search & Filtering',
    features: [
      { name: 'Natural-language search', free: true, premium: true },
      { name: 'Full filter control (caliber, grain, case, price)', free: true, premium: true },
      { name: 'Price-per-round breakdown', free: true, premium: true },
      { name: 'Advanced filters (+P, subsonic, velocity)', free: false, premium: true },
    ]
  },
  { 
    category: 'AI Purpose Detection',
    features: [
      { name: 'Basic purpose detection', free: true, premium: true, freeNote: 'Primary purpose only' },
      { name: 'Deep AI purpose interpretation', free: false, premium: true },
      { name: 'Indoor/outdoor context awareness', free: false, premium: true },
      { name: 'Short-barrel & suppressor optimization', free: false, premium: true },
      { name: 'Overpenetration & flash risk adjustment', free: false, premium: true },
    ]
  },
  { 
    category: 'Results & Ranking',
    features: [
      { name: 'Standard relevance ranking', free: true, premium: true },
      { name: 'Purpose-optimized ranking', free: false, premium: true },
      { name: 'Performance-aware matching', free: false, premium: true },
      { name: 'Best Value scoring', free: false, premium: true },
      { name: 'Reliability insights', free: false, premium: true },
    ]
  },
  { 
    category: 'AI Insights',
    features: [
      { name: 'Purpose summary badge', free: true, premium: true },
      { name: 'AI explanation for results', free: false, premium: true },
      { name: 'Performance badges on products', free: false, premium: true },
    ]
  },
  { 
    category: 'Alerts & History',
    features: [
      { name: 'Price drop alerts', free: true, premium: true, freeNote: 'Delayed 1 hour' },
      { name: 'Real-time instant alerts', free: false, premium: true },
      { name: 'Active alerts', free: '5 max', premium: 'Unlimited' },
      { name: 'Price history charts', free: false, premium: true },
    ]
  },
]

// Plan card data
const plans = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Start Smart',
    description: 'For shooters who want reliable search and basic AI-powered results.',
    monthlyPrice: 0,
    annualPrice: 0,
    highlights: [
      'AI-assisted search (basic)',
      'Full access to all filters',
      'Price-per-round breakdown',
      'Basic price alerts (delayed)',
      'Purpose detection badges',
    ],
    limitations: [
      'No deep AI understanding',
      'No performance-based ranking',
      'No AI explanations',
      'No Best Value scoring',
      'Delayed alerts (1 hour)',
    ],
    bestFor: 'Casual shooters, bargain hunters, or anyone who already knows exactly what they want.',
    cta: 'Get Started Free',
    popular: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Expert-Level Guidance',
    description: 'For shooters who want precision recommendations and expert insight.',
    monthlyPrice: PRICING.PREMIUM_MONTHLY,
    annualPrice: PRICING.PREMIUM_ANNUAL,
    highlights: [
      'Everything in Free, plus:',
      'Advanced AI purpose interpretation',
      'Purpose-optimized result ranking',
      'AI explanations & insights',
      'Best Value scoring',
      'Performance badges & filters',
      'Full price history charts',
      'Real-time instant alerts',
      'Unlimited active alerts',
    ],
    limitations: [],
    bestFor: 'Home defense buyers, competitive shooters, high-volume range shooters, and anyone who wants the best ammo decisions with the least effort.',
    cta: 'Upgrade to Premium',
    popular: true,
  },
]

export function PricingPlans() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(true)
  const [loading, setLoading] = useState<string | null>(null)

  const handlePlanClick = async (planId: string) => {
    setLoading(planId)

    try {
      if (planId === 'free') {
        if (session) {
          router.push('/search')
        } else {
          router.push('/auth/signin')
        }
      } else if (planId === 'premium') {
        if (!session?.user?.id) {
          router.push('/auth/signin?callbackUrl=/pricing')
          return
        }

        // Select price based on billing period
        const priceId = isAnnual 
          ? (process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL || 'price_premium_annual')
          : (process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly')

        const { url } = await createCheckoutSession({
          priceId,
          userId: session.user.id,
          successUrl: `${window.location.origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/pricing`
        })

        window.location.href = url
      }
    } catch (error) {
      console.error('Failed to process plan selection:', error)
      alert('Failed to process your request. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-12">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <Switch
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
        />
        <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Annual
        </span>
        {isAnnual && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Save {PRICING.SAVINGS_PERCENT}%
          </Badge>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative flex flex-col ${
              plan.popular 
                ? 'border-2 border-blue-500 shadow-xl shadow-blue-500/10' 
                : 'border'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center gap-1 px-3">
                  <Zap className="h-3 w-3" />
                  Most Popular
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                {plan.id === 'premium' ? (
                  <Sparkles className="h-5 w-5 text-blue-500" />
                ) : (
                  <Target className="h-5 w-5 text-gray-500" />
                )}
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
              </div>
              <p className="text-sm font-medium text-muted-foreground">{plan.tagline}</p>
              
              <div className="mt-4">
                {plan.monthlyPrice === 0 ? (
                  <div>
                    <span className="text-4xl font-bold">$0</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-4xl font-bold">
                      ${isAnnual ? PRICING.PREMIUM_ANNUAL_MONTHLY.toFixed(2) : plan.monthlyPrice.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                    {isAnnual && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed ${PRICING.PREMIUM_ANNUAL}/year
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <CardDescription className="mt-4">{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-4">
              {/* Highlights */}
              <div className="space-y-2">
                {plan.highlights.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Limitations */}
              {plan.limitations.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">What's limited:</p>
                  {plan.limitations.map((limitation, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <X className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{limitation}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Best For */}
              <div className="pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Best for:</p>
                <p className="text-sm text-muted-foreground">{plan.bestFor}</p>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                className={`w-full ${
                  plan.popular 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                    : ''
                }`}
                variant={plan.popular ? 'default' : 'outline'}
                size="lg"
                onClick={() => handlePlanClick(plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? 'Processing...' : plan.cta}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Feature Comparison Table */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">
          Free vs Premium — What You Get
        </h2>
        
        <div className="max-w-4xl mx-auto overflow-hidden rounded-xl border">
          {/* Table Header */}
          <div className="grid grid-cols-3 bg-gray-50 dark:bg-gray-800/50 border-b">
            <div className="p-4 font-medium">Feature</div>
            <div className="p-4 font-medium text-center">Free</div>
            <div className="p-4 font-medium text-center bg-blue-50 dark:bg-blue-900/20">Premium</div>
          </div>
          
          {/* Feature Categories */}
          {featureComparison.map((category, catIndex) => (
            <div key={catIndex}>
              {/* Category Header */}
              <div className="grid grid-cols-3 bg-gray-100/50 dark:bg-gray-800/30 border-b">
                <div className="col-span-3 p-3 font-semibold text-sm text-muted-foreground">
                  {category.category}
                </div>
              </div>
              
              {/* Features */}
              {category.features.map((feature, featIndex) => (
                <div 
                  key={featIndex} 
                  className="grid grid-cols-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <div className="p-3 text-sm">{feature.name}</div>
                  <div className="p-3 text-center">
                    {typeof feature.free === 'boolean' ? (
                      feature.free ? (
                        <div className="flex flex-col items-center">
                          <Check className="h-5 w-5 text-green-500" />
                          {feature.freeNote && (
                            <span className="text-xs text-muted-foreground mt-0.5">{feature.freeNote}</span>
                          )}
                        </div>
                      ) : (
                        <X className="h-5 w-5 text-gray-300 mx-auto" />
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">{feature.free}</span>
                    )}
                  </div>
                  <div className="p-3 text-center bg-blue-50/50 dark:bg-blue-900/10">
                    {typeof feature.premium === 'boolean' ? (
                      feature.premium ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-gray-300 mx-auto" />
                      )
                    ) : (
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{feature.premium}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-8 pb-4">
        <p className="text-muted-foreground mb-4">
          Making important ammo decisions? Unlock Premium for deeper AI analysis and expert-level recommendations.
        </p>
        <Button 
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          onClick={() => handlePlanClick('premium')}
          disabled={loading === 'premium'}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {loading === 'premium' ? 'Processing...' : 'Upgrade to Premium'}
        </Button>
      </div>
    </div>
  )
}
