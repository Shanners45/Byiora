export default function ContactLoading() {
  return (
    <div className="min-h-screen bg-brand-white animate-pulse">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 w-full h-16 bg-gray-100 border-b border-gray-200" />

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Page title skeleton */}
        <div className="text-center mb-10">
          <div className="h-10 w-64 bg-gray-200 rounded-lg mx-auto mb-4" />
          <div className="h-5 w-96 bg-gray-100 rounded mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact form skeleton */}
          <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
            <div className="h-6 w-40 bg-gray-200 rounded mb-6" />
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-10 w-full bg-gray-200 rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-10 w-full bg-gray-200 rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-10 w-full bg-gray-200 rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-32 w-full bg-gray-200 rounded-lg" />
            </div>
            <div className="h-11 w-full bg-gray-300 rounded-lg mt-2" />
          </div>

          {/* Contact info skeleton */}
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 bg-gray-50 rounded-xl p-5">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 bg-gray-200 rounded" />
                  <div className="h-4 w-48 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
