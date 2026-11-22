"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Download, Eye, Search } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { exportMerchantOrdersAction, getMerchantOrderCodesAction, listMerchantOrdersAction, type MerchantOrderRow } from "@/app/actions/merchant-trade"
import { CodeList } from "@/components/merchant/code-list"
import { Pager } from "@/components/merchant/pager"
import { useMerchantState } from "@/lib/merchant/context"
import { amberCard, fmtDateTime, inputCls, npr, PageHeader, Spinner, StatCard } from "@/components/merchant/ui"

type Source = "all" | "dashboard" | "api"
type Data = NonNullable<Awaited<ReturnType<typeof listMerchantOrdersAction>>>
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`

export default function MerchantOrders() {
  const { tick } = useMerchantState()
  const [data, setData] = useState<Data | null>(null)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [source, setSource] = useState<Source>("all")
  const [includeTest, setIncludeTest] = useState(false)
  const [viewing, setViewing] = useState<{ order: MerchantOrderRow; codes: string[] | null } | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    listMerchantOrdersAction(page, search, source, includeTest).then((d) => d && setData(d))
  }, [page, search, source, includeTest, tick])

  if (!data) return <Spinner label="Loading orders..." />
  const { totals } = data

  const open = async (order: MerchantOrderRow) => {
    setViewing({ order, codes: null })
    const res = await getMerchantOrderCodesAction(order.id)
    if (!res.success) {
      setViewing(null)
      return toast.error(res.error)
    }
    setViewing({ order, codes: res.codes })
  }

  const exportCsv = async () => {
    setExporting(true)
    const rows = await exportMerchantOrdersAction(search, source)
    setExporting(false)
    if (!rows) return toast.error("Export failed.")
    const out = [["Order ID", "Your reference", "Date", "Product", "Amount", "Quantity", "Unit price (NPR)", "Total (NPR)", "Status", "Source", "Customer email", "Customer name", "Customer phone", "Your SKU", "Your name"]]
    for (const o of rows) out.push([o.id, o.clientRef || "", fmtDateTime(o.createdAt), o.product, o.denomination, String(o.quantity), String(o.unitPaisa / 100), String(o.totalPaisa / 100), o.status, o.source, o.customer?.email || "", o.customer?.name || "", o.customer?.phone || "", o.sku || "", o.displayName || ""])
    const blob = new Blob([out.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `byiora-orders-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Orders" subtitle="Every code you've bought, from the dashboard and the API.">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting || !data.total} className="h-9 border-[#F59E0B] text-[#92400E] bg-[#FEF7E0] hover:bg-[#FEF7E0]/80 font-semibold">
          <Download className="h-4 w-4 mr-1.5" />{exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard label="Total Orders" value={totals.orders.toLocaleString()} />
        <StatCard label="Total Spent" value={npr(totals.spendPaisa)} valueCls="text-[#7E3AF2]" />
        <StatCard label="Codes Delivered" value={totals.codes.toLocaleString()} />
        <StatCard label="Refunded" value={totals.refunded.toLocaleString()} hint={totals.refunded ? npr(totals.refundedPaisa) : undefined} valueCls={totals.refunded ? "text-amber-600" : "text-[#1F2937]"} />
      </div>

      <Card className={`${amberCard} overflow-hidden`}>
        <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 space-y-0">
          <div>
            <CardTitle className="text-[#1F2937] text-lg font-bold">Order history ({data.total.toLocaleString()})</CardTitle>
            <CardDescription className="text-[#92400E]">API orders show the customer you sent with the order</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <label className="inline-flex items-center gap-2 text-sm text-[#92400E] font-semibold cursor-pointer select-none">
              <input type="checkbox" checked={includeTest} onChange={(e) => { setIncludeTest(e.target.checked); setPage(1) }} className="h-4 w-4 accent-[#7E3AF2]" />
              Test orders
            </label>
            <select value={source} onChange={(e) => { setSource(e.target.value as Source); setPage(1) }} className={`border px-3 text-sm ${inputCls}`} aria-label="Filter by source">
              <option value="all">All sources</option>
              <option value="dashboard">Dashboard</option>
              <option value="api">API</option>
            </select>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Product, customer or reference" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} pl-9`} aria-label="Search orders" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {data.rows.length === 0 ? (
            <p className="text-center text-sm text-[#4B5563] py-12">{search || source !== "all" ? "No orders match." : "No orders yet."}</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-[#F59E0B]/20 bg-white">
                <Table className="min-w-[860px]">
                  <TableHeader className="bg-[#FEF7E0]/40 border-b-2 border-[#F59E0B]/20">
                    <TableRow>
                      {["Date", "Product", "Customer", "Total", "Status"].map((h) => <TableHead key={h} className="text-[#1F2937] font-bold text-xs uppercase tracking-wider">{h}</TableHead>)}
                      <TableHead className="text-right text-[#1F2937] font-bold text-xs uppercase tracking-wider">Codes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((o) => (
                      <TableRow key={o.id} className="hover:bg-[#FEF7E0]/50 border-b border-gray-100">
                        <TableCell className="text-xs text-[#4B5563] py-3">{fmtDateTime(o.createdAt)}<div className="text-[11px] uppercase font-semibold">{o.source}{o.isTest ? " · test" : ""}</div></TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm font-semibold text-[#1F2937]">{o.displayName || o.product}</div>{o.sku && <div className="font-mono text-[11px] text-[#7E3AF2]">{o.sku}</div>}
                          <div className="text-xs text-[#6B7280]">{o.denomination} × {o.quantity}{o.clientRef && o.source === "api" ? ` · your ref ${o.clientRef}` : ""}</div>
                        </TableCell>
                        <TableCell className="py-3">
                          {o.customer ? (<><div className="text-sm text-[#1F2937]">{o.customer.name || "—"}</div><div className="text-xs text-[#6B7280]">{o.customer.email}</div></>) : <span className="text-xs text-[#9CA3AF]">—</span>}
                        </TableCell>
                        <TableCell className="text-sm font-bold py-3">{npr(o.totalPaisa)}</TableCell>
                        <TableCell className="py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold ${o.status === "completed" ? "bg-emerald-100 text-emerald-900 border-emerald-300" : o.status === "pending" ? "bg-blue-100 text-blue-900 border-blue-300" : "bg-amber-100 text-amber-900 border-amber-300"}`} title={o.refundNote || undefined}>
                            {o.status === "completed" ? "Completed" : o.status === "pending" ? "Delivery delay" : "Refunded"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <Button size="sm" variant="outline" onClick={() => open(o)} className="h-8 px-3 text-xs border-purple-300 text-purple-900 hover:bg-purple-50 font-semibold">
                            <Eye className="h-3.5 w-3.5 mr-1.5" />View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager page={page} total={data.total} onPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1F2937]">{viewing?.order.product}</DialogTitle>
            <DialogDescription className="text-xs text-[#4B5563]">{viewing?.order.denomination} · {viewing && fmtDateTime(viewing.order.createdAt)} · Order {viewing?.order.id.slice(0, 8)}</DialogDescription>
          </DialogHeader>
          {viewing?.order.customer && <p className="text-sm text-[#4B5563]">Customer: <span className="font-semibold text-[#1F2937]">{viewing.order.customer.name || viewing.order.customer.email}</span>{viewing.order.customer.name ? ` · ${viewing.order.customer.email}` : ""}{viewing.order.customer.phone ? ` · ${viewing.order.customer.phone}` : ""}</p>}
          {viewing?.order.status === "refunded" && <p className="text-sm rounded-lg bg-amber-50 border border-amber-300 text-amber-900 p-3">Refunded to your wallet{viewing.order.refundNote ? `: ${viewing.order.refundNote}` : ""}.</p>}
          {viewing?.order.status === "pending" && <p className="text-sm rounded-lg bg-blue-50 border border-blue-300 text-blue-900 p-3">This amount was out of stock when you ordered. Your wallet was charged and we are getting the codes. They appear here, and an <span className="font-mono">order.completed</span> webhook is sent, as soon as the order is filled. If we can&apos;t fill it, the full amount goes back to your wallet.</p>}
          {viewing?.order.status === "pending" ? null : viewing?.codes ? <CodeList codes={viewing.codes} /> : <p className="text-sm text-[#4B5563] py-4 text-center">Loading codes…</p>}
          {viewing && <a href={`/merchant/dashboard/support?order=${viewing.order.id}`} className="text-xs font-semibold text-[#7E3AF2] hover:underline text-center">Problem with this order? Open a support ticket</a>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
