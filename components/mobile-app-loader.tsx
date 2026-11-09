import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mobile-only app launch / route loading screen.
 * Intentionally logo-free (no splash branding, no bottom progress line).
 */
export function MobileAppLoader() {
  return (
    <div className="md:hidden min-h-screen bg-brand-white">
      {/* Top bar */}
      <div className="h-16 border-b border-gray-100 bg-white px-4 flex items-center justify-between">
        <Skeleton className="h-9 w-28 rounded-md bg-gray-200" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full bg-gray-200" />
          <Skeleton className="h-9 w-9 rounded-full bg-gray-200" />
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Hero */}
        <Skeleton className="h-[180px] w-full rounded-2xl bg-gray-200" />

        {/* Section title */}
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-gray-200" />
          <Skeleton className="h-5 w-36 bg-gray-200" />
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-3">
              <Skeleton className="aspect-square w-full rounded-lg mb-2 bg-gray-200" />
              <Skeleton className="h-3 w-3/4 mx-auto bg-gray-100" />
            </div>
          ))}
        </div>

        {/* Section title */}
        <Skeleton className="h-5 w-40 bg-gray-200" />

        {/* List rows */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl bg-gray-200" />
          ))}
        </div>
      </div>
    </div>
  )
}
