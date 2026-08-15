"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DollarSign, ArrowUpRight, TrendingUp, CreditCard, Package, RotateCcw, ShieldAlert } from "lucide-react"
import { getAllTransactionsAction } from "@/app/actions/dashboard"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts"

const COLORS = ['#7E3AF2', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6']

function getRefundAmount(t: any): number {
  if (t.failure_remarks) {
    const match = t.failure_remarks.match(/Rs\.?\s*([\d,]+(\.\d+)?)/i)
    if (match && match[1]) {
      const parsed = Number.parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(parsed)) return parsed
    }
  }
  const cleanPrice = String(t.price || '0').replace(/,/g, '')
  const parsed = Number.parseFloat(cleanPrice)
  return isNaN(parsed) ? 0 : parsed
}

export default function RevenuePage() {
  const [allTransactions, setAllTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  const currentDate = useMemo(() => new Date(), [])
  const [selectedMonth, setSelectedMonth] = useState<string>(currentDate.getMonth().toString())
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString())

  useEffect(() => {
    setIsMounted(true)
    const fetchTransactions = async () => {
      setLoading(true)
      const result = await getAllTransactionsAction()
      if (result.success && result.data) {
        setAllTransactions(result.data)
      }
      setLoading(false)
    }
    fetchTransactions()
  }, [])

  // Filter transactions based on selected month and year
  const completedTransactions = useMemo(() => allTransactions.filter(t => {
    if (t.status !== "Completed") return false
    const date = new Date(t.created_at)
    return date.getMonth().toString() === selectedMonth && date.getFullYear().toString() === selectedYear
  }), [allTransactions, selectedMonth, selectedYear])

  const refundedTransactions = useMemo(() => allTransactions.filter(t => {
    if (t.status !== "Refunded") return false
    const date = new Date(t.created_at)
    return date.getMonth().toString() === selectedMonth && date.getFullYear().toString() === selectedYear
  }), [allTransactions, selectedMonth, selectedYear])

  // Calculate gross revenue (from completed orders)
  const grossRevenue = useMemo(() => completedTransactions.reduce((sum, t) => {
    const cleanPrice = String(t.price).replace(/,/g, '')
    const parsed = Number.parseFloat(cleanPrice)
    return sum + (isNaN(parsed) ? 0 : parsed)
  }, 0), [completedTransactions])

  // Calculate total refunds
  const totalRefunded = useMemo(() => refundedTransactions.reduce((sum, t) => {
    return sum + getRefundAmount(t)
  }, 0), [refundedTransactions])

  // Net revenue = Gross Revenue - Refunds
  const netRevenue = useMemo(() => Math.max(0, grossRevenue - totalRefunded), [grossRevenue, totalRefunded])

  // Get available years from transactions
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(allTransactions.map(t => new Date(t.created_at).getFullYear()))).sort((a, b) => b - a)
    if (!years.includes(currentDate.getFullYear())) {
      years.unshift(currentDate.getFullYear())
    }
    return years
  }, [allTransactions, currentDate])

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  // 1. Revenue Trend Chart
  const trendData = useMemo(() => {
    const year = parseInt(selectedYear)
    const month = parseInt(selectedMonth)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return {
        date: `${day} ${months[month].substring(0, 3)}`,
        dayNum: day,
        gross: 0,
        refunds: 0,
        net: 0,
      }
    })

    completedTransactions.forEach(t => {
      const date = new Date(t.created_at)
      const day = date.getDate()
      const cleanPrice = String(t.price).replace(/,/g, '')
      const parsed = Number.parseFloat(cleanPrice)
      if (!isNaN(parsed) && day >= 1 && day <= daysInMonth) {
        dailyData[day - 1].gross += parsed
        dailyData[day - 1].net += parsed
      }
    })

    refundedTransactions.forEach(t => {
      const date = new Date(t.created_at)
      const day = date.getDate()
      const amt = getRefundAmount(t)
      if (day >= 1 && day <= daysInMonth) {
        dailyData[day - 1].refunds += amt
        dailyData[day - 1].net = Math.max(0, dailyData[day - 1].net - amt)
      }
    })

    return dailyData
  }, [completedTransactions, refundedTransactions, selectedMonth, selectedYear])

  // 2. Payment Methods Split (Completed)
  const paymentMethodData = useMemo(() => {
    const methods: Record<string, number> = {}
    completedTransactions.forEach(t => {
      const cleanPrice = String(t.price).replace(/,/g, '')
      const parsed = Number.parseFloat(cleanPrice)
      if (!isNaN(parsed)) {
        let method = t.payment_method || t.paymentMethod || t.payment_type || 'Unknown'
        if (method.toLowerCase().includes('esewa')) method = 'eSewa'
        else if (method.toLowerCase().includes('khalti')) method = 'Khalti'
        else if (method.toLowerCase().includes('fonepay')) method = 'Fonepay'
        else if (method.toLowerCase().includes('nepalpay')) method = 'NepalPay'

        methods[method] = (methods[method] || 0) + parsed
      }
    })

    return Object.entries(methods).map(([name, value]) => ({ name, value }))
  }, [completedTransactions])

  // 3. Top Performing Products
  const topProducts = useMemo(() => {
    const productStats: Record<string, { name: string; units: number; revenue: number }> = {}

    completedTransactions.forEach(t => {
      const cleanPrice = String(t.price).replace(/,/g, '')
      const parsed = Number.parseFloat(cleanPrice)
      const productName = t.product_name || 'Unknown Product'

      if (!productStats[productName]) {
        productStats[productName] = { name: productName, units: 0, revenue: 0 }
      }

      productStats[productName].units += 1
      if (!isNaN(parsed)) {
        productStats[productName].revenue += parsed
      }
    })

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [completedTransactions])

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Revenue Dashboard</h1>
          <p className="text-[#4B5563]">Track and analyze platform revenue, orders, and refunds</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 bg-transparent font-medium">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-gray-200"></div>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] border-none shadow-none focus:ring-0 bg-transparent font-medium">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-[#7E3AF2] border-gray-200"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Gross Revenue */}
            <Card className="border-none shadow-md bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Gross Revenue</p>
                    <div className="text-2xl font-bold text-[#1F2937]">
                      Rs. {grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{completedTransactions.length} completed orders</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Refunded */}
            <Card className="border-none shadow-md bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700 mb-1 flex items-center gap-1">
                      <span>Total Refunded</span>
                    </p>
                    <div className="text-2xl font-bold text-purple-700">
                      Rs. {totalRefunded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-purple-600 font-medium mt-1">
                      {refundedTransactions.length} {refundedTransactions.length === 1 ? 'refunded order' : 'refunded orders'}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <RotateCcw className="h-6 w-6 text-purple-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Net Revenue */}
            <Card className="border-none shadow-md bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Net Revenue</p>
                    <div className="text-2xl font-bold text-[#7E3AF2]">
                      Rs. {netRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Gross minus refunds</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-[#7E3AF2]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selected Period Info */}
            <Card className="border-none shadow-md bg-gradient-to-br from-[#7E3AF2] to-[#9D68F5] text-white">
              <CardContent className="p-6">
                <div className="flex flex-col justify-center h-full">
                  <p className="text-white/80 font-medium mb-1">Selected Period</p>
                  <div className="text-xl font-bold">
                    {months[parseInt(selectedMonth)]} {selectedYear}
                  </div>
                  <p className="text-sm text-white/70 mt-1 flex items-center">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    {completedTransactions.length + refundedTransactions.length} total processed
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* 1. Revenue Trend Chart */}
            <Card className="border-none shadow-sm lg:col-span-2">
              <CardHeader className="pb-2 border-b border-gray-50">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-[#7E3AF2]/10 flex items-center justify-center mr-3">
                    <TrendingUp className="h-4 w-4 text-[#7E3AF2]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Revenue Trend</CardTitle>
                    <CardDescription className="text-gray-400">Daily gross revenue and refunds for the selected month</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-8">
                <div className="h-[300px] w-full">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7E3AF2" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#7E3AF2" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorRefunds" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickMargin={10}
                          minTickGap={20}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickFormatter={(value) => value >= 1000 ? `Rs. ${value / 1000}k` : `Rs. ${value}`}
                          width={80}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                          formatter={(value, name) => {
                            const n = typeof value === "number" ? value : Number(value ?? 0)
                            const label = name === "gross" ? "Gross Revenue" : name === "refunds" ? "Refunds" : "Net Revenue"
                            return [`Rs. ${n.toLocaleString()}`, label]
                          }}
                          labelStyle={{ fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="gross"
                          stroke="#7E3AF2"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                          name="gross"
                        />
                        {totalRefunded > 0 && (
                          <Area
                            type="monotone"
                            dataKey="refunds"
                            stroke="#EF4444"
                            strokeWidth={2}
                            fillOpacity={0.5}
                            fill="url(#colorRefunds)"
                            name="refunds"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Payment Methods Split */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 border-b border-gray-50">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-[#10B981]/10 flex items-center justify-center mr-3">
                    <CreditCard className="h-4 w-4 text-[#10B981]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Payment Methods</CardTitle>
                    <CardDescription className="text-gray-400">Completed revenue by provider</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {paymentMethodData.length > 0 ? (
                  <div className="h-[300px] w-full flex flex-col items-center justify-center">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentMethodData}
                            cx="50%"
                            cy="45%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {paymentMethodData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => {
                              const n = typeof value === "number" ? value : Number(value ?? 0)
                              return [`Rs. ${n.toLocaleString()}`, 'Revenue']
                            }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center text-gray-400">
                    <CreditCard className="h-12 w-12 mb-3 text-gray-200" />
                    <p>No payment data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 3. Refunded Orders Breakdown */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-purple-100 flex items-center justify-center mr-3">
                    <RotateCcw className="h-4 w-4 text-purple-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-purple-950">Refunded Orders</CardTitle>
                    <CardDescription className="text-gray-500">
                      All refunded orders for {months[parseInt(selectedMonth)]} {selectedYear}
                    </CardDescription>
                  </div>
                </div>
                {refundedTransactions.length > 0 && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 font-semibold">
                    {refundedTransactions.length} {refundedTransactions.length === 1 ? "Refund" : "Refunds"} (Rs. {totalRefunded.toLocaleString()})
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {refundedTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-purple-50/50 border-b border-purple-100 text-gray-600">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">Order ID</th>
                        <th className="px-6 py-3.5 font-semibold">Customer</th>
                        <th className="px-6 py-3.5 font-semibold">Product</th>
                        <th className="px-6 py-3.5 font-semibold">Payment Method</th>
                        <th className="px-6 py-3.5 font-semibold">Refund Details</th>
                        <th className="px-6 py-3.5 font-semibold text-right">Refunded Amount</th>
                        <th className="px-6 py-3.5 font-semibold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {refundedTransactions.map((txn) => {
                        const refundAmt = getRefundAmount(txn)
                        const customerName = txn.users?.name || txn.guest_user_data?.name || txn.user_email?.split('@')[0] || "Customer"

                        return (
                          <tr key={txn.id || txn.transaction_id} className="hover:bg-purple-50/30 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-gray-700">
                              {txn.transaction_id}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{customerName}</div>
                              <div className="text-xs text-gray-500">{txn.user_email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{txn.product_name}</div>
                              <div className="text-xs text-gray-500">{txn.amount}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-700">
                              <Badge variant="outline" className="text-xs border-gray-300">
                                {txn.payment_method || "Dynamic QR"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              {txn.failure_remarks ? (
                                <span className="inline-block text-xs font-medium text-purple-800 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                                  {txn.failure_remarks}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-purple-700">
                              Rs. {refundAmt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-right text-xs text-gray-500">
                              {new Date(txn.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500">
                  <RotateCcw className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="font-medium text-gray-600">No refunded orders in {months[parseInt(selectedMonth)]} {selectedYear}</p>
                  <p className="text-xs text-gray-400 mt-1">When orders are refunded via Khalti or admin action, they will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Top Performing Products */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-[#F59E0B]/10 flex items-center justify-center mr-3">
                    <Package className="h-4 w-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Top Performing Products</CardTitle>
                    <CardDescription className="text-gray-400">Highest revenue generating items this month</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-4 font-medium text-gray-500">Product</th>
                        <th className="px-6 py-4 font-medium text-gray-500 text-center">Units Sold</th>
                        <th className="px-6 py-4 font-medium text-gray-500 text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topProducts.map((product, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center font-medium text-[#1F2937]">
                              <div className="h-8 w-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center mr-3 text-gray-500 text-xs">
                                #{idx + 1}
                              </div>
                              {product.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {product.units}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-[#10B981]">
                            Rs. {product.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500">
                  <Package className="h-10 w-10 text-gray-300 mb-3" />
                  <p>No products sold in this period.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
