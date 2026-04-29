import { Skeleton } from "@/components/ui/skeleton"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />
      
      {/* Banner Skeleton */}
      <div className="w-full relative bg-black/40">
        <Skeleton className="w-full aspect-[21/9] md:aspect-[3/1] bg-white/5" />
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Category section skeleton */}
        <div className="mb-12">
          <Skeleton className="h-8 w-48 mb-6 bg-white/10" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glassmorphism bg-white/5 rounded-xl overflow-hidden border border-white/10 flex flex-col h-full">
                <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-[120px] relative">
                  <Skeleton className="w-16 h-16 rounded-lg bg-white/10" />
                </div>
                <div className="p-3 bg-black/20 mt-auto text-center border-t border-white/5">
                  <Skeleton className="h-4 w-3/4 mx-auto bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Second section skeleton */}
        <div className="mb-12">
          <Skeleton className="h-8 w-48 mb-6 bg-white/10" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glassmorphism bg-white/5 rounded-xl overflow-hidden border border-white/10 flex flex-col h-full">
                <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-[120px] relative">
                  <Skeleton className="w-16 h-16 rounded-lg bg-white/10" />
                </div>
                <div className="p-3 bg-black/20 mt-auto text-center border-t border-white/5">
                  <Skeleton className="h-4 w-3/4 mx-auto bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  )
}
