import { Header } from "@/components/header"
import { MobileAppLoader } from "@/components/mobile-app-loader"

export default function Loading() {
  return (
    <>
      {/* Mobile: clean skeleton loader — no logo splash, no bottom accent line */}
      <MobileAppLoader />

      {/* Desktop */}
      <div className="hidden md:block min-h-screen bg-brand-purple">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/5 rounded w-1/4" />
            <div className="h-64 bg-white/5 rounded w-full" />
          </div>
        </main>
      </div>
    </>
  )
}
