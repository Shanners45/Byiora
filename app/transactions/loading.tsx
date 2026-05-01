import { Header } from "@/components/header"

export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-brand-white">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-9 w-32 bg-gray-200 rounded-lg" />
            <div className="h-9 w-56 bg-gray-200 rounded-lg" />
          </div>
          <div className="h-10 w-40 bg-gray-200 rounded-lg" />
        </div>

        {/* Transaction cards */}
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 animate-pulse">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div className="h-5 w-48 bg-gray-200 rounded" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-3 w-20 bg-gray-100 rounded" />
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                    <div className="h-4 w-28 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="h-4 w-36 bg-gray-100 rounded" />
                <div className="h-9 w-36 bg-gray-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
