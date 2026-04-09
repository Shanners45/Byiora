"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { Users, ShoppingBag, DollarSign, Package, UserCheck, Bell } from "lucide-react"
import Link from "next/link"
import { getDashboardStatsAction } from "@/app/actions/dashboard"

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  recentOrders: any[]
  topProducts: any[]
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    recentOrders: [],
    topProducts: [],
  })
  const [loading, setLoading] = useState(true)
  const [adminUser, setAdminUser] = useState<{ name: string; role: string } | null>(null)

  useEffect(() => {
    // Get current admin user
    const storedSession = localStorage.getItem("byiora_admin_session")
    if (storedSession) {
      try {
        const parsedUser = JSON.parse(storedSession)
        setAdminUser(parsedUser)
      } catch (error) {
        console.error("Error parsing admin session:", error)
      }
    }

    loadDashboardStats()
  }, [])

  // Refresh stats when window gains focus (e.g., when returning from orders page)
  useEffect(() => {
    const handleFocus = () => {
      loadDashboardStats()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const loadDashboardStats = async () => {
    try {
      setLoading(true)

      // Use Server Action with Service Role to bypass RLS
      const result = await getDashboardStatsAction()

      if (result.error) {
        console.error("Error loading dashboard stats:", result.error)
        return
      }

      if (result.stats) {
        setStats(result.stats)
      }
    } catch (error) {
      console.error("Error loading dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800"
      case "Processing":
        return "bg-blue-100 text-blue-800"
      case "Failed":
        return "bg-red-100 text-red-800"
      case "Cancelled":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
          <p className="text-[#4B5563]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">
          Welcome back, {adminUser?.name || "Admin"}!
        </h1>
        <p className="text-[#4B5563]">Here's what's happening with your store today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Total Users</p>
                <p className="text-2xl font-bold text-[#1F2937]">{stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-[#F59E0B]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Total Products</p>
                <p className="text-2xl font-bold text-[#1F2937]">{stats.totalProducts}</p>
              </div>
              <Package className="h-8 w-8 text-[#F59E0B]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Total Orders</p>
                <p className="text-2xl font-bold text-[#1F2937]">{stats.totalOrders}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-[#F59E0B]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Total Revenue</p>
                <p className="text-2xl font-bold text-[#1F2937]">Rs. {stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-[#F59E0B]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/dashboard/products/add">
          <Button className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white h-12">
            <Package className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Link>
        <Link href="/admin/dashboard/orders">
          <Button className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white h-12">
            <ShoppingBag className="h-4 w-4 mr-2" />
            View Orders
          </Button>
        </Link>
        <Link href="/admin/dashboard/admin-users">
          <Button className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white h-12">
            <UserCheck className="h-4 w-4 mr-2" />
            Manage Admins
          </Button>
        </Link>
        <Link href="/admin/dashboard/notifications">
          <Button className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white h-12">
            <Bell className="h-4 w-4 mr-2" />
            Send Notifications
          </Button>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">Recent Orders</CardTitle>
            <CardDescription className="text-[#92400E]">Latest customer transactions</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {stats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#F59E0B]/20"
                >
                  <div>
                    <p className="font-medium text-[#1F2937]">{order.product_name}</p>
                    <p className="text-sm text-[#4B5563]">{order.user_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[#1F2937]">Rs. {order.price}</p>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  </div>
                </div>
              ))}
              {stats.recentOrders.length === 0 && <p className="text-center text-[#4B5563] py-4">No recent orders</p>}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">Active Products</CardTitle>
            <CardDescription className="text-[#92400E]">Currently available products</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {stats.topProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#F59E0B]/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-[#1F2937]">{product.name}</p>
                      <p className="text-sm text-[#4B5563] capitalize">{product.category}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              ))}
              {stats.topProducts.length === 0 && (
                <p className="text-center text-[#4B5563] py-4">No products available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
