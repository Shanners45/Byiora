"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Printer } from "lucide-react"

/** Code block with language tabs and a copy button. */
export function CodeTabs({ samples, title }: { samples: Record<string, string>; title?: string }) {
  const langs = Object.keys(samples)
  const [lang, setLang] = useState(langs[0])
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(samples[lang]).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  })
  return (
    <div className="rounded-xl overflow-hidden border border-[#1F2937] my-4 break-inside-avoid">
      <div className="flex items-center justify-between gap-2 bg-[#111827] px-3 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {title && <span className="text-[11px] font-semibold text-gray-400 mr-2 shrink-0">{title}</span>}
          {langs.length > 1 &&
            langs.map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${l === lang ? "bg-[#7E3AF2] text-white" : "text-gray-300 hover:bg-white/10"}`}>
                {l}
              </button>
            ))}
        </div>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white print:hidden shrink-0" aria-label="Copy code">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-[#1F2937] text-[#E5E7EB] text-[12.5px] leading-relaxed p-4 overflow-x-auto print:whitespace-pre-wrap"><code>{samples[lang]}</code></pre>
    </div>
  )
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white text-sm font-bold shadow-sm print:hidden">
      <Printer className="h-4 w-4" />
      Download PDF
    </button>
  )
}

/** Docs sidebar that highlights the section currently on screen. */
export function DocsToc({ items }: { items: [string, string][] }) {
  const [active, setActive] = useState(items[0]?.[0])
  useEffect(() => {
    const els = items.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const update = () => {
      // The last heading that has scrolled past the top third of the screen is the current one.
      const line = window.innerHeight * 0.3
      let current = els[0]?.id
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = els[els.length - 1]?.id
      setActive(current)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [items])

  return (
    <div className="sticky top-6 space-y-0.5 text-sm max-h-[calc(100vh-3rem)] overflow-y-auto pr-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#92400E] mb-2">Contents</p>
      {items.map(([id, label]) => {
        const sub = /^\d+\.\d/.test(label)
        const on = id === active
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={on ? "location" : undefined}
            className={`block rounded-md px-2 py-1.5 border-l-2 transition-colors ${sub ? "pl-5 text-[13px]" : "font-medium"} ${on ? "border-[#7E3AF2] bg-[#F5F0FB] text-[#7E3AF2] font-semibold" : "border-transparent text-[#374151] hover:bg-[#F5F0FB] hover:text-[#7E3AF2]"}`}
          >
            {label}
          </a>
        )
      })}
    </div>
  )
}
