import type React from "react"

// Admin-dashboard look shared by the merchant portal pages.
export const amberCard = "bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl"
export const inputCls = "bg-white border-[#E5E7EB] text-[#1F2937] placeholder:text-gray-400 focus:border-[#7E3AF2] focus:ring-[#7E3AF2] rounded-xl h-10"
export const primaryBtn = "bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold shadow-sm"

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937]">{title}</h1>
        <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

export function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/90 rounded-lg p-3 border border-[#F59E0B]/20 shadow-xs min-w-0">
      <span className="text-[11px] text-[#92400E] font-medium block">{label}</span>
      <span className="text-sm font-bold text-[#111827] break-words">{children}</span>
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="text-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
      <p className="text-[#4B5563]">{label}</p>
    </div>
  )
}

/** Paisa → "Rs. 1,23,456.50" (Nepali grouping, decimals only when needed). */
export const npr = (paisa: number) =>
  `Rs. ${(paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: paisa % 100 ? 2 : 0, maximumFractionDigits: 2 })}`

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

export function StatCard({ label, value, hint, valueCls = "text-[#1F2937]" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; valueCls?: string }) {
  return (
    <div className={`${amberCard} p-3 sm:p-5 min-w-0`}>
      <p className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider truncate">{label}</p>
      <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${valueCls}`}>{value}</p>
      {hint && <div className="text-[11px] sm:text-xs text-[#6B7280] mt-1 truncate">{hint}</div>}
    </div>
  )
}

/** Shown above actions a merchant can see but not use until verified. */
export function LockedNote({ show, children }: { show: boolean; children?: React.ReactNode }) {
  if (!show) return null
  return (
    <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-3.5 text-sm text-purple-900">
      {children || "You can look around, but this unlocks once your business is verified and your account is active."}
    </div>
  )
}
