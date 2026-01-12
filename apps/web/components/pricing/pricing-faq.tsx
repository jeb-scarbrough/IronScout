'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'Is pricing available in v1?',
    answer: 'Not yet. All users have the same capabilities during v1.'
  },
  {
    question: 'What does your search do?',
    answer: 'IronScout uses AI to understand ammo listings and normalize product data across retailers. This helps you search by intent rather than relying solely on exact keywords.'
  },
  {
    question: 'Do you sell ammunition?',
    answer: 'No. IronScout is a search and comparison tool only. All purchases happen directly with retailers.'
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
