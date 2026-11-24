"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, ShoppingBag, Wallet, KeyRound, UserCog, Lock, LogOut, Menu, X, TrendingUp, Headset, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMerchantStateAction, logoutMerchantAction } from "@/app/actions/merchant"
import { MerchantStateContext, type MerchantState } from "@/lib/merchant/context"
import { npr } from "@/components/merchant/ui"
import { createClient } from "@/lib/supabase/client"
import { useRealtimePings } from "@/lib/realtime/use-pings"
import { posthog } from "@/lib/analytics/posthog"
import { MerchantNotificationPanel } from "@/components/merchant/notification-panel"
import { BrandLoader } from "@/components/brand-loader"

const NAV = [
  { name: "Overview", href: "/merchant/dashboard", icon: LayoutDashboard, gated: false },
  { name: "Catalog", href: "/merchant/dashboard/catalog", icon: Package, gated: false },
  { name: "Orders", href: "/merchant/dashboard/orders", icon: ShoppingBag, gated: true },
  { name: "Revenue", href: "/merchant/dashboard/revenue", icon: TrendingUp, gated: false },
  { name: "Wallet", href: "/merchant/dashboard/wallet", icon: Wallet, gated: true },
  { name: "API Keys", href: "/merchant/dashboard/api-keys", icon: KeyRound, gated: true },
  { name: "Support", href: "/merchant/dashboard/support", icon: Headset, gated: false },
  { name: "Account", href: "/merchant/dashboard/account", icon: UserCog, gated: false },
]

function LockBanner({ state }: { state: MerchantState }) {
  if (state.canUse) return null
  const { status, statusReason, kycStatus } = state.merchant
  const [tone, title, text] =
    status === "suspended"
      ? ["bg-amber-50 border-amber-300 text-amber-900", "Account suspended", `${statusReason ? `${statusReason}. ` : ""}You can view everything, but ordering and API access are paused.`]
      : kycStatus === "submitted"
        ? ["bg-purple-50 border-purple-300 text-purple-900", "Verification under review", "We'll email you when your account is unlocked, usually within 1–2 business days."]
        : kycStatus === "more_info"
          ? ["bg-amber-50 border-amber-300 text-amber-900", "Changes needed", "We need a few changes to your verification documents."]
          : kycStatus === "rejected"
            ? ["bg-red-50 border-red-300 text-red-900", "Verification not approved", "See why and submit your documents again."]
            : ["bg-purple-50 border-purple-300 text-purple-900", "Account locked", "Verify your business to unlock ordering, your wallet and API keys."]
  return (
    <div className={`mb-5 sm:mb-6 rounded-xl border-2 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${tone}`}>
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-sm">{title}</p>
          <p className="text-xs sm:text-sm mt-0.5">{text}</p>
        </div>
      </div>
      {status !== "suspended" && kycStatus !== "submitted" && (
        <Button asChild size="sm" className="h-9 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold shadow-sm shrink-0">
          <Link href="/merchant/dashboard/account">Go to verification</Link>
        </Button>
      )}
    </div>
  )
}

export default function MerchantDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [state, setState] = useState<MerchantState | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  // Bumped on every realtime ping; pages refetch when it changes.
  const [tick, setTick] = useState(0)

  const refresh = useCallback(async () => {
    const s = await getMerchantStateAction()
    // Signed out, banned, or first-login steps still open: the login page handles all three.
    if (!s || s.stage !== "ready") return void (window.location.href = "/merchant/login")
    setState(s)
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => setSidebarOpen(false), [pathname])
  // Identify the merchant in PostHog (it loads lazily) so admin sees their real "last active".
  const merchantId = state?.merchant.id
  useEffect(() => {
    if (!state) return
    const { email, businessName } = state.merchant
    let tries = 0
    const id = setInterval(() => {
      if (posthog.__loaded) {
        posthog.identify(`merchant_${merchantId}`, { email, merchant: true, business_name: businessName })
        clearInterval(id)
      } else if (++tries > 20) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [merchantId]) // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimePings(createClient({ merchant: true }), state ? `merchant:${state.merchant.id}` : null, () => {
    refresh()
    setTick((t) => t + 1)
  })

  const signOut = async () => {
    await logoutMerchantAction()
    window.location.href = "/merchant/login"
  }

  if (!state) return <BrandLoader label="Loading dashboard" />

  const isActive = (href: string) => (href === "/merchant/dashboard" ? pathname === href : pathname.startsWith(href))

  return (
    <MerchantStateContext.Provider value={{ state, refresh, tick }}>
      <div className="flex h-dvh w-full overflow-hidden bg-[#F9FAFB] overscroll-none">
        <aside
          className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 z-50 flex w-64 flex-col bg-white border-r border-[#E5E7EB] transition-transform duration-300 lg:translate-x-0 lg:static lg:h-dvh lg:shrink-0`}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3">
              <Image src="https://www.byiora.com.np/logo-final.png" alt="Byiora Logo" width={110} height={32} style={{ objectFit: "contain", width: "auto", height: 30 }} priority unoptimized />
              <span className="text-lg font-semibold text-[#7E3AF2] tracking-wide">Merchant</span>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5 text-[#4B5563]" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
            {NAV.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#7E3AF2] text-white shadow-sm" : "text-[#374151] hover:bg-[#F5F0FB]"}`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                  {item.gated && !state.canUse && <Lock className={`ml-auto h-3.5 w-3.5 ${active ? "text-white/80" : "text-[#9CA3AF]"}`} aria-label="Locked until verified" />}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1F2937] truncate">{state.merchant.businessName}</p>
                <p className="text-xs text-[#6B7280] truncate">{state.merchant.email}</p>
                <p className={`text-xs font-semibold mt-1 ${state.canUse ? "text-emerald-600" : "text-[#7E3AF2]"}`}>{state.canUse ? "Verified merchant" : "Not verified yet"}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-[#4B5563] hover:bg-[#F5F0FB] shrink-0" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col h-dvh overflow-hidden min-w-0">
          <header className="bg-white border-b border-[#E5E7EB] shadow-sm shrink-0">
            <div className="flex h-16 items-center justify-between gap-3 px-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <Menu className="h-5 w-5 text-[#4B5563]" />
              </Button>
              <span className="hidden sm:block text-sm text-[#4B5563]">
                {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
              <button type="button" onClick={() => setNotifOpen(true)} className="ml-auto relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F5F0FB] hover:text-[#7E3AF2]" aria-label={state.unreadNotifications ? `Notifications, ${state.unreadNotifications} unread` : "Notifications"}>
                <Bell className="h-4 w-4" />
                {state.unreadNotifications > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center px-1">{state.unreadNotifications > 9 ? "9+" : state.unreadNotifications}</span>}
              </button>
              <Link href="/merchant/dashboard/wallet" className="inline-flex items-center gap-2 rounded-lg border-2 border-[#F59E0B]/30 bg-[#FEF7E0] px-3 py-1.5 text-sm font-bold text-[#1F2937] hover:bg-[#FEF7E0]/70">
                <Wallet className="h-4 w-4 text-[#92400E]" />
                {npr(state.merchant.balancePaisa)}
              </Link>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overscroll-contain bg-[#F9FAFB] p-4 md:p-6">
            <LockBanner state={state} />
            {children}
          </main>
        </div>

        <MerchantNotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} unread={state.unreadNotifications} tick={tick} onSeen={refresh} />
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-gray-600/75 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      </div>
    </MerchantStateContext.Provider>
  )
}
