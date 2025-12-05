'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'What does "AI-powered search" mean?',
    answer: 'IronScout uses artificial intelligence to understand what you\'re looking for, not just match keywords. When you search "best 9mm for home defense," our AI understands you need hollow points optimized for short-barrel reliability, reduced overpenetration, and trusted defensive brands—not just any 9mm ammo.'
  },
  {
    question: 'What\'s the difference between Free and Premium AI?',
    answer: 'Free users get basic purpose detection (e.g., "Training" or "Defense"). Premium users get deep AI interpretation that considers indoor vs outdoor use, barrel length, suppressor compatibility, overpenetration concerns, flash reduction, and more. Premium also includes AI-generated explanations for why specific products match your needs.'
  },
  {
    question: 'What is "Best Value Score"?',
    answer: 'Best Value Score is a Premium feature that combines multiple factors: current price vs 30-day average for that caliber, shipping costs, retailer reliability, brand reputation, and how well the product matches your stated purpose. It helps you find ammo that\'s truly a good deal, not just cheap.'
  },
  {
    question: 'Why are Free alerts delayed?',
    answer: 'Free price alerts are delayed by 1 hour to give Premium subscribers first access to deals. In the ammo market, popular deals can sell out in minutes. Premium users get real-time instant notifications so they never miss a price drop or restock.'
  },
  {
    question: 'Can I still use filters with AI search?',
    answer: 'Absolutely. Our system is designed for both AI-assisted and filter-driven searches. You can type natural language queries, use specific filters, or combine both. When you set filters manually, the AI respects your choices and optimizes within your constraints.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe. Your payment information is never stored on our servers.'
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes. You can cancel your Premium subscription at any time from your account settings. You\'ll continue to have Premium access until the end of your billing period. No questions asked, no cancellation fees.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'We don\'t offer a traditional free trial, but our Free tier gives you full access to basic search and filtering forever. This lets you try IronScout before deciding if Premium features are worth it for your needs.'
  },
  {
    question: 'What happens to my alerts if I downgrade?',
    answer: 'If you downgrade from Premium to Free, your alerts will continue to work but with a 1-hour delay. If you have more than 5 active alerts, they\'ll remain active but you won\'t be able to create new ones until you\'re under the limit.'
  },
  {
    question: 'Do you sell ammunition?',
    answer: 'No. IronScout is a search and comparison tool only. We help you find the best prices and products across multiple retailers, but all purchases are made directly from those retailers. We earn affiliate commissions on some purchases, which helps keep the Free tier free.'
  },
]

export function PricingFAQ() {
  return (
    <div className="max-w-3xl mx-auto mt-16">
      <h2 className="text-2xl font-bold text-center mb-8">
        Frequently Asked Questions
      </h2>
      
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
