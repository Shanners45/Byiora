import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: {
    index: false,
    follow: false,
  },
  // Don't inherit the storefront homepage canonical.
  alternates: { canonical: null },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {children}
    </div>
  )
}
