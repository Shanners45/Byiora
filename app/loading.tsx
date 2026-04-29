import { Header } from "@/components/header"

export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />
      {/* Generic loading state for all other routes */}
      <main className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/5 rounded w-1/4" />
          <div className="h-64 bg-white/5 rounded w-full" />
        </div>
      </main>
    </div>
  )
}
