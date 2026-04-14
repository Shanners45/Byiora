"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Package, Settings, Users, LogOut, Menu, X, Bell, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [adminUser, setAdminUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Auth check with proper loading state using SSR client
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.replace("/admin/login")
          return
        }

        const { data: adminData } = await supabase
          .from("admin_users")
          .select("id, name, email, role, status")
          .eq("id", user.id)
          .single()

        if (!adminData || adminData.status === "blocked") {
          await supabase.auth.signOut()
          localStorage.clear()
          router.replace("/admin/login")
          toast.error(adminData?.status === "blocked" ? "Your account has been blocked" : "Session expired")
          return
        }

        setAdminUser(adminData)
        // Sync to localStorage for usage in child pages
        localStorage.setItem("admin_user", JSON.stringify(adminData))
        localStorage.setItem("byiora_admin_session", JSON.stringify(adminData))
      } catch (error) {
        console.error("Session validation error:", error)
        router.replace("/admin/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()


    // Handle responsive sidebar
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      setSidebarOpen(!mobile)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Logged out successfully")
    router.replace("/admin/login")
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
          <p className="text-[#4B5563]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // If no admin user after loading, don't render anything (redirect will happen)
  if (!adminUser) {
    return null
  }

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "sub_admin", "order_management"],
    },
    {
      name: "Orders",
      href: "/admin/dashboard/orders",
      icon: ShoppingBag,
      roles: ["admin", "sub_admin", "order_management"],
    },
    { name: "Products", href: "/admin/dashboard/products", icon: Package, roles: ["admin", "sub_admin"] },
    { name: "Customisation", href: "/admin/dashboard/customisation", icon: ImageIcon, roles: ["admin", "sub_admin"] },
    { name: "Admin Users", href: "/admin/dashboard/admin-users", icon: Users, roles: ["admin"] },
    { name: "Notifications", href: "/admin/dashboard/notifications", icon: Bell, roles: ["admin", "sub_admin"] },
    {
      name: "Settings",
      href: "/admin/dashboard/settings",
      icon: Settings,
      roles: ["admin", "sub_admin", "order_management"],
    },
  ].filter((item) => item.roles.includes(adminUser?.role || ""))

  const isActive = (path: string) => pathname === path

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator"
      case "sub_admin":
        return "Sub-admin"
      case "order_management":
        return "Order Manager"
      default:
        return "User"
    }
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 z-50 flex w-64 flex-col bg-[#7E3AF2] text-white border-r border-[#E5E7EB] pt-5 pb-4 transition-transform duration-300 lg:translate-x-0 lg:static lg:w-64`}
      >
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center">
            <div className="h-8 relative mr-2 flex items-center">
              <Image
                src="/logo-final.png"
                alt="Byiora Logo"
                width={120}
                height={36}
                style={{ objectFit: 'contain', width: 'auto' }}
                priority
              />
            </div>
            <span className="text-lg font-semibold text-white ml-2">Admin</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-5 flex flex-1 flex-col">
          <nav className="flex-1 space-y-1 px-2">
            {navItems.map((item) => (
              <Button
                key={item.name}
                variant="ghost"
                className={`w-full justify-start text-white hover:bg-white/10 ${isActive(item.href) ? "bg-[#E0D4FD] text-[#1F2937]" : ""
                  }`}
                onClick={() => router.push(item.href)}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive(item.href) ? "text-[#1F2937]" : ""}`} />
                {item.name}
              </Button>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{adminUser?.name}</p>
              <p className="text-xs text-white/70">{adminUser?.email}</p>
              <p className="text-xs font-medium text-[#E0D4FD] mt-1">{getRoleDisplayName(adminUser?.role || "")}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-[#E5E7EB] shadow-sm">
          <div className="flex h-16 items-center justify-between px-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-[#4B5563]" />
            </Button>
            <div className="flex items-center">
              <span className="text-sm text-[#4B5563]">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#F9FAFB] p-4 md:p-6">{children}</main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
