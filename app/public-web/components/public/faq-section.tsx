'use client'

import { useState } from 'react'
import type { LandingResponse } from '@cjl/contracts'
import { Plus, Minus } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'
import { cn } from '@/lib/utils'

interface FAQSectionProps {
  faqs: LandingResponse['faqs']
}

export function FAQSection({ faqs }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [headerRef, headerVisible] = useReveal()
  const [listRef, listVisible] = useReveal(0.05)

  return (
    <section id="faq" className="py-28 bg-white">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-14" ref={headerRef}>
            <div className={cn('reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-soft bg-bg-soft text-pink-hot text-xs font-semibold uppercase tracking-wider mb-5', headerVisible && 'visible')}>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-hot" />
              FAQ
            </div>
            <h2 className={cn('reveal font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-text-strong leading-tight text-balance', headerVisible && 'visible')}>
              Ada Pertanyaan?
            </h2>
            <p className={cn('reveal delay-100 text-text-body text-lg mt-4 leading-relaxed', headerVisible && 'visible')}>
              Temukan jawaban untuk pertanyaan umum tentang layanan CJ Laundry.
            </p>
          </div>

          {/* FAQ list */}
          <div className="space-y-3" ref={listRef}>
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index
              return (
                <div
                  key={index}
                  className={cn(
                    'reveal group rounded-2xl border transition-all duration-300 overflow-hidden',
                    `delay-${Math.min(index * 60, 400)}`,
                    listVisible && 'visible',
                    isOpen
                      ? 'border-pink-soft bg-pink-cloud/40 shadow-lg shadow-pink-hot/5'
                      : 'border-line-soft bg-bg-soft hover:border-pink-soft'
                  )}
                >
                  <button
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span className={cn(
                      'font-display font-semibold text-base leading-snug pr-4 transition-colors',
                      isOpen ? 'text-pink-hot' : 'text-text-strong group-hover:text-pink-hot'
                    )}>
                      {faq.question}
                    </span>
                    <div className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300',
                      isOpen ? 'bg-pink-hot text-white rotate-0' : 'bg-white border border-line-soft text-text-muted group-hover:border-pink-soft group-hover:text-pink-hot'
                    )}>
                      {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                  </button>

                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300',
                      isOpen ? 'max-h-48' : 'max-h-0'
                    )}
                  >
                    <p className="px-6 pb-5 text-text-body text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
