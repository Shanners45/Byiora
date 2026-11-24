// Shown inside the dashboard frame (sidebar stays) until the page and its own loader take over.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-200" />)}
      </div>
      <div className="h-64 rounded-xl bg-gray-200" />
    </div>
  )
}
