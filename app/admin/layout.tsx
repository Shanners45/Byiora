import type React from "react"
import { Toaster } from "sonner"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Byiora Admin",
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      {children}
      <Toaster position="top-right" richColors />
    </div>
  )
}
