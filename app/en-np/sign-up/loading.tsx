import { Button } from "@/components/ui/button"

export default function SignUpLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-purple">
      {/* Skeleton Header */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-brand-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-24 h-8 bg-gray-200 animate-pulse rounded-md" />
          </div>
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="w-full h-10 bg-gray-100 animate-pulse rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-brand-sky-blue/20 animate-pulse w-24 h-8 rounded-full" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4 relative overflow-hidden bg-brand-purple">
        {/* Background Decorative Elements placeholders */}
        <div className="absolute top-20 left-10 text-[#FFD700] opacity-10 select-none">
          <div className="w-10 h-5 bg-[#FFD700] rounded-full animate-pulse" />
        </div>
        <div className="absolute bottom-20 right-10 text-[#FFD700] opacity-10 select-none">
          <div className="w-16 h-8 bg-[#FFD700] rounded-full animate-pulse" />
        </div>

        {/* Skeleton Card */}
        <div className="w-full max-w-[500px] bg-[#3a1a4f] border border-[#4a2a5f] rounded-3xl p-8 md:p-12 shadow-2xl z-10">
          <div className="text-center mb-10 space-y-3">
            <div className="h-4 w-32 bg-white/10 animate-pulse mx-auto rounded" />
            <div className="h-8 w-48 bg-white/20 animate-pulse mx-auto rounded-lg" />
          </div>

          <div className="space-y-4">
            <div className="w-full h-14 bg-white/10 animate-pulse rounded-full" />
            <div className="w-full h-14 bg-white/10 animate-pulse rounded-full" />
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <div className="h-3 w-40 bg-white/5 animate-pulse mx-auto rounded" />
              <div className="h-3 w-32 bg-white/5 animate-pulse mx-auto rounded" />
            </div>
            
            <div className="h-px bg-white/10 w-full" />
            
            <div className="h-4 w-48 bg-white/10 animate-pulse mx-auto rounded" />
          </div>
        </div>
      </main>

      {/* Skeleton Footer */}
      <footer className="w-full">
        <div className="bg-brand-soft-yellow/80 py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="h-4 w-24 bg-brand-charcoal/10 animate-pulse rounded" />
                <div className="h-8 w-32 bg-brand-charcoal/20 animate-pulse rounded-lg" />
              </div>
              <div className="space-y-4">
                <div className="h-4 w-24 bg-brand-charcoal/10 animate-pulse rounded" />
                <div className="h-8 w-32 bg-brand-charcoal/20 animate-pulse rounded-lg" />
              </div>
              <div className="space-y-4">
                <div className="h-4 w-32 bg-brand-charcoal/10 animate-pulse rounded" />
                <div className="flex space-x-2">
                  <div className="h-8 w-8 bg-brand-charcoal/20 animate-pulse rounded-full" />
                  <div className="h-8 w-8 bg-brand-charcoal/20 animate-pulse rounded-full" />
                  <div className="h-8 w-8 bg-brand-charcoal/20 animate-pulse rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 py-4">
          <div className="container mx-auto px-4">
            <div className="h-4 w-64 bg-gray-200 animate-pulse rounded mx-auto" />
          </div>
        </div>
      </footer>
    </div>
  )
}
