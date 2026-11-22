"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export const PAGE_SIZE = 10

/** "Showing 11–20 of 53" with previous/next. Renders nothing when everything fits on one page. */
export function Pager({ page, total, onPage, pageSize = PAGE_SIZE }: { page: number; total: number; onPage: (p: number) => void; pageSize?: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3">
      <p className="text-xs text-[#6B7280]">Showing {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}</p>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-8 bg-white" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-xs font-semibold text-[#1F2937] px-2">Page {page} of {pages}</span>
        <Button size="sm" variant="outline" className="h-8 bg-white" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

/** Client-side paging for lists that are already loaded. Jumps back to page 1 when the list changes shape. */
export function usePaged<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  useEffect(() => {
    if (page > pages) setPage(1)
  }, [page, pages])
  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize])
  return { page: Math.min(page, pages), setPage, pageItems, total: items.length }
}
