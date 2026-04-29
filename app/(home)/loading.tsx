import { Skeleton } from "@/components/ui/skeleton"
import { Header } from "@/components/header"

export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Banner Skeleton — matches BannerCarousel dimensions */}
        <section className="mb-12">
          <Skeleton className="w-full h-[340px] md:h-[420px] rounded-2xl bg-white/5" />
        </section>

        {/* Category Section 1 */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 rounded-full bg-brand-sky-blue flex-shrink-0" />
            <Skeleton className="h-8 w-48 bg-white/10" />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 overflow-hidden">
                <Skeleton className="aspect-square rounded-lg mb-3 bg-gray-700" />
                <Skeleton className="h-4 w-3/4 mx-auto bg-white/10" />
              </div>
            ))}
          </div>
        </section>

        {/* Category Section 2 */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 rounded-full bg-brand-sky-blue flex-shrink-0" />
            <Skeleton className="h-8 w-48 bg-white/10" />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 overflow-hidden">
                <Skeleton className="aspect-square rounded-lg mb-3 bg-gray-700" />
                <Skeleton className="h-4 w-3/4 mx-auto bg-white/10" />
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* No Footer — prevents the yellow footer flash during route transitions */}
    </div>
  )
}
