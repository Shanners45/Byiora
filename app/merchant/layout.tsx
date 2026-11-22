import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Merchant Portal",
  robots: { index: false, follow: false },
}

export default function MerchantRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F9FAFB]" style={{ colorScheme: "light" }}>{children}</div>
}
