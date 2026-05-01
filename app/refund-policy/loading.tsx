export default function PolicyLoading() {
  return (
    <div className="min-h-screen bg-brand-white animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full h-16 bg-gray-100 border-b border-gray-200" />

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Title */}
        <div className="h-10 w-72 bg-gray-200 rounded-lg mx-auto mb-4" />
        <div className="h-4 w-48 bg-gray-100 rounded mx-auto mb-10" />

        {/* Content blocks */}
        <div className="space-y-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-6 w-56 bg-gray-200 rounded" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-100 rounded" />
                <div className="h-4 w-full bg-gray-100 rounded" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
