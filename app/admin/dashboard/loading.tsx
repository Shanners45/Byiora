// The dashboard's standard loading spinner (same as the layout's "Loading dashboard...").
export default function AdminDashboardLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
        <p className="text-[#4B5563]">{label}</p>
      </div>
    </div>
  )
}
