"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"
import DOMPurify from "isomorphic-dompurify"

interface FaqItemProps {
  question: string
  answer: string
}

export function FaqAccordion({ faqs }: { faqs: FaqItemProps[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  if (!faqs || faqs.length === 0) return null

  return (
    <div className="space-y-3">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index

        return (
          <div 
            key={index} 
            className={`border rounded-xl overflow-hidden transition-all duration-300 ${
              isOpen 
                ? "border-brand-sky-blue/30 bg-white shadow-md shadow-brand-sky-blue/5" 
                : "border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200"
            }`}
          >
            <button
              onClick={() => toggleOpen(index)}
              className="w-full flex items-center justify-between p-4 text-left transition-colors focus:outline-none"
              aria-expanded={isOpen}
            >
              <h4 className={`text-sm font-medium pr-4 ${isOpen ? "text-brand-charcoal" : "text-brand-charcoal/80"}`}>
                {faq.question}
              </h4>
              <div 
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isOpen ? "bg-brand-sky-blue/20 text-brand-sky-blue rotate-180" : "bg-gray-100 text-gray-400 rotate-0"
                }`}
              >
                {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </div>
            </button>
            
            <div 
              className={`grid transition-all duration-300 ease-in-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div 
                  className="p-4 pt-0 text-xs text-brand-light-gray prose-rich-text"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(faq.answer, { ADD_ATTR: ['target', 'rel', 'class'] }) 
                  }} 
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
