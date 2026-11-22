"use client"

import { toast } from "sonner"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CodeList({ codes }: { codes: string[] }) {
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"))
  return (
    <div className="space-y-2">
      {codes.map((c, i) => (
        <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[#F59E0B]/30 bg-[#FEF7E0]/60 px-3 py-2">
          <code className="font-mono text-sm text-[#1F2937] break-all">{c}</code>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copy(c)} aria-label="Copy code"><Copy className="h-4 w-4" /></Button>
        </div>
      ))}
      {codes.length > 1 && (
        <Button size="sm" variant="outline" className="h-8 border-purple-300 text-purple-900 hover:bg-purple-50 font-semibold" onClick={() => copy(codes.join("\n"))}>
          <Copy className="h-3.5 w-3.5 mr-1.5" />Copy all
        </Button>
      )}
    </div>
  )
}
