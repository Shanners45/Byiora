"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DollarSign, ArrowUpRight, TrendingUp, CreditCard, Package, RotateCcw } from "lucide-react"
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
  const [transactions, setTransactions] = useState<any[]>([])
  const [productsList, setProductsList] = useState<any[]>([])
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
        setTransactions(result.data)
        if ((result as any).products) {
          setProductsList((result as any).products)
        }
      }
      setLoading(false)
    }
    fetchTransactions()
  }, [])

  // Build a lookup map of product ID and slug -> current product name
  const productMap = useMemo(() => {
    const map = new Map<string, string>()
    productsList.forEach((p: any) => {
      if (p.id && p.name) map.set(p.id, p.name)
      if (p.slug && p.name) map.set(p.slug, p.name)
      if (p.name) map.set(p.name.toLowerCase().trim(), p.name)
    })
    return map
  }, [productsList])

  // Filter completed transactions for the selected month and year
  const completedTransactions = useMemo(() => transactions.filter(t => {
    if (t.status !== "Completed") return false
    const date = new Date(t.created_at)
    return date.getMonth().toString() === selectedMonth && date.getFullYear().toString() === selectedYear
  }), [transactions, selectedMonth, selectedYear])

  // Filter refunded transactions for the selected month and year
  const refundedTransactions = useMemo(() => transactions.filter(t => {
    if (t.status !== "Refunded") return false
    const date = new Date(t.created_at)
    return date.getMonth().toString() === selectedMonth && date.getFullYear().toString() === selectedYear
  }), [transactions, selectedMonth, selectedYear])

  // Calculate gross revenue from completed orders
  const grossRevenue = useMemo(() => completedTransactions.reduce((sum, t) => {
    const cleanPrice = String(t.price || '0').replace(/,/g, '')
    const parsed = Number.parseFloat(cleanPrice)
    return sum + (isNaN(parsed) ? 0 : parsed)
  }, 0), [completedTransactions])

  // Calculate total refunds
  const totalRefunded = useMemo(() => refundedTransactions.reduce((sum, t) => {
    return sum + getRefundAmount(t)
  }, 0), [refundedTransactions])

  // Net revenue = Gross Revenue - Refunds
  const totalRevenue = useMemo(() => Math.max(0, grossRevenue - totalRefunded), [grossRevenue, totalRefunded])

  // Get available years from transactions
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(transactions.map(t => new Date(t.created_at).getFullYear()))).sort((a, b) => b - a)
    if (!years.includes(currentDate.getFullYear())) {
      years.unshift(currentDate.getFullYear())
    }
    return years
  }, [transactions, currentDate])

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  // 1. Revenue Trend Chart (Daily net revenue)
  const trendData = useMemo(() => {
    const year = parseInt(selectedYear)
    const month = parseInt(selectedMonth)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return {
        date: `${day} ${months[month].substring(0, 3)}`,
        dayNum: day,
        revenue: 0,
      }
    })

    completedTransactions.forEach(t => {
      const date = new Date(t.created_at)
      const day = date.getDate()
      const cleanPrice = String(t.price || '0').replace(/,/g, '')
      const parsed = Number.parseFloat(cleanPrice)
      if (!isNaN(parsed) && day >= 1 && day <= daysInMonth) {
        dailyData[day - 1].revenue += parsed
      }
    })

    return dailyData
  }, [completedTransactions, selectedMonth, selectedYear])

  // 2. Payment Methods Split
  const paymentMethodData = useMemo(() => {
    const methods: Record<string, number> = {}
    completedTransactions.forEach(t => {
      const cleanPrice = String(t.price || '0').replace(/,/g, '')
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
  // Consolidates past and new transactions under the current canonical product name
  const topProducts = useMemo(() => {
    const productStats: Record<string, { name: string; units: number; revenue: number }> = {}

    // Sort chronologically descending so latest product_name is available as fallback
    const sortedTxns = [...completedTransactions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    sortedTxns.forEach(t => {
      const cleanPrice = String(t.price || '0').replace(/,/g, '')
      const parsed = Number.parseFloat(cleanPrice)
      
      // Resolve canonical product name from current catalog if available
      let canonicalName = t.product_name || 'Unknown Product'
      if (t.product_id && productMap.has(t.product_id)) {
        canonicalName = productMap.get(t.product_id)!
      } else if (productMap.has(canonicalName.toLowerCase().trim())) {
        canonicalName = productMap.get(canonicalName.toLowerCase().trim())!
      }

      // Group key: product_id takes precedence, then canonical name
      const groupKey = t.product_id || canonicalName.toLowerCase().trim()

      if (!productStats[groupKey]) {
        productStats[groupKey] = { name: canonicalName, units: 0, revenue: 0 }
      }

      productStats[groupKey].units += 1
      if (!isNaN(parsed)) {
        productStats[groupKey].revenue += parsed
      }
    })

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [completedTransactions, productMap])

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Revenue Dashboard</h1>
          <p className="text-[#4B5563]">Track and analyze your platform's financial performance</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border-2 border-[#F59E0B]/30 shadow-sm">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 bg-transparent font-medium text-[#1F2937]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-[#F59E0B]/20"></div>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] border-none shadow-none focus:ring-0 bg-transparent font-medium text-[#1F2937]">
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
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-[#F59E0B] border-gray-200"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#92400E] mb-1">Total Revenue</p>
                    <div className="text-3xl font-bold text-[#1F2937]">
                      Rs. {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    {totalRefunded > 0 && (
                      <p className="text-xs text-[#92400E] mt-1 font-medium">
                        (Rs. {totalRefunded.toLocaleString()} refunded)
                      </p>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white border border-[#F59E0B]/30 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-[#F59E0B]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#92400E] mb-1">Completed Orders</p>
                    <div className="text-3xl font-bold text-[#1F2937]">
                      {completedTransactions.length}
                    </div>
                    {refundedTransactions.length > 0 && (
                      <p className="text-xs text-[#92400E]/70 mt-1">
                        {refundedTransactions.length} {refundedTransactions.length === 1 ? 'refund' : 'refunds'}
                      </p>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white border border-[#F59E0B]/30 flex items-center justify-center">
                    <Package className="h-6 w-6 text-[#F59E0B]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#92400E] mb-1">Selected Period</p>
                    <div className="text-2xl font-bold text-[#1F2937]">
                      {months[parseInt(selectedMonth)]} {selectedYear}
                    </div>
                    <p className="text-xs text-[#92400E]/80 mt-1 flex items-center">
                      <ArrowUpRight className="h-4 w-4 mr-1 text-[#F59E0B]" />
                      Data up to date
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white border border-[#F59E0B]/30 flex items-center justify-center">
                    <RotateCcw className="h-6 w-6 text-[#F59E0B]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* 1. Revenue Trend Chart */}
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md lg:col-span-2">
              <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-white border border-[#F59E0B]/30 flex items-center justify-center mr-3">
                    <TrendingUp className="h-4 w-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-[#1F2937]">Revenue Trend</CardTitle>
                    <CardDescription className="text-[#92400E]">Daily revenue for the selected month</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-white p-4 rounded-lg border border-[#F59E0B]/20 shadow-inner">
                  <div className="h-[300px] w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#7E3AF2" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#7E3AF2" stopOpacity={0} />
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
                            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => {
                              const n = typeof value === "number" ? value : Number(value ?? 0)
                              return [`Rs. ${n.toLocaleString()}`, 'Revenue']
                            }}
                            labelStyle={{ fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#7E3AF2"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Payment Methods Split */}
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-white border border-[#F59E0B]/30 flex items-center justify-center mr-3">
                    <CreditCard className="h-4 w-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-[#1F2937]">Payment Methods</CardTitle>
                    <CardDescription className="text-[#92400E]">Revenue by provider</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="bg-white p-4 rounded-lg border border-[#F59E0B]/20 shadow-inner">
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
                              contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-gray-400">
                      <CreditCard className="h-12 w-12 mb-3 text-gray-300" />
                      <p>No payment data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Top Performing Products */}
          <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md mt-6">
            <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-white border border-[#F59E0B]/30 flex items-center justify-center mr-3">
                    <Package className="h-4 w-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-[#1F2937]">Top Performing Products</CardTitle>
                    <CardDescription className="text-[#92400E]">Highest revenue generating items this month</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {topProducts.length > 0 ? (
                <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-x-auto bg-white shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white border-b border-[#F59E0B]/20">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-[#1F2937]">Product</th>
                        <th className="px-6 py-4 font-semibold text-[#1F2937] text-center">Units Sold</th>
                        <th className="px-6 py-4 font-semibold text-[#1F2937] text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F59E0B]/10">
                      {topProducts.map((product, idx) => (
                        <tr key={idx} className="hover:bg-[#FEF7E0]/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center font-medium text-[#1F2937]">
                              <div className="h-7 w-7 rounded bg-[#FEF7E0] border border-[#F59E0B]/30 flex items-center justify-center mr-3 text-[#92400E] font-bold text-xs">
                                #{idx + 1}
                              </div>
                              {product.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {product.units}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-[#10B981]">
                            Rs. {product.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500 bg-white rounded-lg border border-[#F59E0B]/20">
                  <Package className="h-10 w-10 text-gray-300 mb-3" />
                  <p>No products sold in this period.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Refunded Orders (only if refunds exist in this period) */}
          {refundedTransactions.length > 0 && (
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md mt-6">
              <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-md bg-white border border-[#F59E0B]/30 flex items-center justify-center mr-3">
                      <RotateCcw className="h-4 w-4 text-[#F59E0B]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-[#1F2937]">Refunded Orders</CardTitle>
                      <CardDescription className="text-[#92400E]">Orders refunded during this period</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-x-auto bg-white shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white border-b border-[#F59E0B]/20">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-[#1F2937]">Order ID</th>
                        <th className="px-6 py-4 font-semibold text-[#1F2937]">Product</th>
                        <th className="px-6 py-4 font-semibold text-[#1F2937] text-right">Refunded Amount</th>
                        <th className="px-6 py-4 font-semibold text-[#1F2937] text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F59E0B]/10">
                      {refundedTransactions.map((txn) => {
                        const refundAmt = getRefundAmount(txn)
                        return (
                          <tr key={txn.id || txn.transaction_id} className="hover:bg-[#FEF7E0]/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-[#4B5563]">
                              {txn.transaction_id}
                            </td>
                            <td className="px-6 py-4 font-medium text-[#1F2937]">
                              {txn.product_name} {txn.amount ? <span className="text-xs text-gray-400 font-normal">({txn.amount})</span> : null}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-[#7E3AF2]">
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
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
