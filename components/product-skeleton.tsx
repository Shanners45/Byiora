import { Skeleton } from "@/components/ui/skeleton"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArrowLeft, Shield } from "lucide-react"

export function ProductSkeleton() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center text-white/50">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Product Image */}
          <div className="lg:col-span-1 space-y-6 order-1">
            <div className="glassmorphism p-6 bg-white/5 rounded-lg shadow-md border border-white/10">
              <Skeleton className="w-full h-48 rounded-lg mb-4 bg-white/10" />
              <Skeleton className="h-8 w-3/4 bg-white/10" />
            </div>

            {/* Desktop Description */}
            <div className="hidden lg:block space-y-6">
              <div className="glassmorphism p-6 bg-white/5 rounded-lg shadow-md border border-white/10">
                <Skeleton className="h-6 w-1/3 mb-4 bg-white/10" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-4 w-5/6 bg-white/10" />
                  <Skeleton className="h-4 w-4/6 bg-white/10" />
                </div>
              </div>
              
              <div className="glassmorphism p-6 bg-white/5 rounded-lg shadow-md border border-white/10">
                <Skeleton className="h-6 w-1/2 mb-4 bg-white/10" />
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full rounded-md bg-white/10" />
                  <Skeleton className="h-12 w-full rounded-md bg-white/10" />
                  <Skeleton className="h-12 w-full rounded-md bg-white/10" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="lg:col-span-2 space-y-6 order-2">
            <div className="glassmorphism p-6 bg-white/5 rounded-lg shadow-md border border-white/10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-brand-sky-blue/20 flex items-center justify-center">
                  <span className="text-brand-sky-blue text-sm font-bold">1</span>
                </div>
                <Skeleton className="h-6 w-1/3 bg-white/10" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg bg-white/10" />
                ))}
              </div>
            </div>

            <div className="glassmorphism p-6 bg-white/5 rounded-lg shadow-md border border-white/10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-brand-sky-blue/20 flex items-center justify-center">
                  <span className="text-brand-sky-blue text-sm font-bold">2</span>
                </div>
                <Skeleton className="h-6 w-1/3 bg-white/10" />
              </div>
              <Skeleton className="h-12 w-full rounded-md bg-white/10 mb-2" />
              <Skeleton className="h-4 w-2/3 bg-white/10" />
            </div>

            <div className="glassmorphism p-6 bg-white/5 rounded-lg shadow-md border border-white/10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-brand-sky-blue/20 flex items-center justify-center">
                  <span className="text-brand-sky-blue text-sm font-bold">3</span>
                </div>
                <Skeleton className="h-6 w-1/3 bg-white/10" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg bg-white/10" />
                ))}
              </div>
            </div>

            <div className="glassmorphism p-6 bg-white/5 rounded-lg shadow-md border border-white/10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-brand-sky-blue/20 flex items-center justify-center">
                  <span className="text-brand-sky-blue text-sm font-bold">4</span>
                </div>
                <Skeleton className="h-6 w-1/4 bg-white/10" />
              </div>
              <Skeleton className="h-14 w-full rounded-lg bg-white/10 mb-4" />
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-white/30" />
                <Skeleton className="h-4 w-1/2 bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
