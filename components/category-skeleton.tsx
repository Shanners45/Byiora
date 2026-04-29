import { Skeleton } from "@/components/ui/skeleton"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArrowLeft } from "lucide-react"

export function CategorySkeleton() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center text-white/50">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </div>

        <div className="mb-8">
          <Skeleton className="h-10 w-1/3 mb-2 bg-white/10" />
          <Skeleton className="h-5 w-1/4 bg-white/10" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, index) => (
            <div
              key={index}
              className="glassmorphism bg-white/5 rounded-xl overflow-hidden border border-white/10 h-full flex flex-col"
            >
              <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-[140px] relative">
                <Skeleton className="w-20 h-20 rounded-lg bg-white/10" />
              </div>
              <div className="p-3 bg-black/20 mt-auto text-center border-t border-white/5">
                <Skeleton className="h-5 w-3/4 mx-auto mb-2 bg-white/10" />
                <Skeleton className="h-4 w-1/2 mx-auto bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <Footer />
    </div>
  )
}
