import { Header } from "@/components/header"

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-brand-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl animate-pulse">
        {/* Back button + title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-9 w-32 bg-gray-200 rounded-lg" />
          <div className="h-8 w-44 bg-gray-200 rounded-lg" />
        </div>

        {/* Profile card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6 space-y-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-5 w-36 bg-gray-200 rounded" />
              <div className="h-4 w-52 bg-gray-100 rounded" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 bg-gray-100 rounded" />
              <div className="h-10 w-full bg-gray-200 rounded-lg" />
            </div>
          ))}
          <div className="h-10 w-full bg-gray-300 rounded-lg mt-2" />
        </div>

        {/* Password card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
          <div className="h-6 w-40 bg-gray-200 rounded mb-2" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-32 bg-gray-100 rounded" />
              <div className="h-10 w-full bg-gray-200 rounded-lg" />
            </div>
          ))}
          <div className="h-10 w-full bg-gray-300 rounded-lg mt-2" />
        </div>
      </div>
    </div>
  )
}
