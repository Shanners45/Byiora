import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Nunito } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/lib/auth-context"
import { NotificationProvider } from "@/lib/notification-context"

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Byiora",
  description: "The fastest & easiest way to buy premium gift cards. Instant delivery, secure payments.",
  keywords: "gift cards, digital vouchers, instant delivery, secure payment",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={nunito.className}>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <Toaster richColors position="top-right" />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
