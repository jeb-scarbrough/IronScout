'use client';

import { useState } from 'react';

interface AccordionItem {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="border border-iron-800 rounded-lg overflow-hidden bg-iron-950/50"
        >
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-iron-900/50 transition-colors"
          >
            <span className="font-medium text-iron-100">{item.question}</span>
            <svg
              className={`w-5 h-5 text-iron-500 transition-transform ${
                openIndex === i ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* Always in DOM for SEO, hidden visually via CSS */}
          <div className={`px-6 pb-4 ${openIndex === i ? '' : 'hidden'}`}>
            <p className="text-iron-400 leading-relaxed">{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
