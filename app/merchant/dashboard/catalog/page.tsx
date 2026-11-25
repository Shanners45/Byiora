"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Search, CheckCircle2, Minus, Plus, ChevronDown, Tag } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getPricedCatalogAction, placeMerchantOrderAction, saveMerchantSkuAction, type CatalogItem } from "@/app/actions/merchant-trade"
import { useMerchantState } from "@/lib/merchant/context"
import { CodeList } from "@/components/merchant/code-list"
import { Pager, usePaged } from "@/components/merchant/pager"
import { amberCard, inputCls, LockedNote, npr, PageHeader, primaryBtn, Spinner } from "@/components/merchant/ui"

type Denom = CatalogItem["denominations"][number]
type Pick = { product: CatalogItem; denom: Denom }

function BuyDialog({ pick, availablePaisa, onClose, onBought }: { pick: Pick | null; availablePaisa: number; onClose: () => void; onBought: () => void }) {
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)
  // One id per purchase attempt: a retried click can never charge twice.
  const [clientRef, setClientRef] = useState(() => crypto.randomUUID())

  useEffect(() => {
    setQty(1)
    setCodes(null)
    setClientRef(crypto.randomUUID())
  }, [pick])

  if (!pick) return null
  // The catalog only sells what is in stock right now.
  const max = Math.min(20, pick.denom.available)
  const total = pick.denom.pricePaisa * qty
  const short = total > availablePaisa

  const buy = async () => {
    setBusy(true)
    const res = await placeMerchantOrderAction({ productId: pick.product.id, denominationId: pick.denom.id, denomination: pick.denom.label, quantity: qty, clientRef })
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    setCodes(res.codes)
    toast.success("Order complete")
    onBought()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1F2937]">{codes ? "Your codes" : `Buy ${pick.product.name}`}</DialogTitle>
          <DialogDescription className="text-xs text-[#4B5563]">{codes ? "Also saved under Orders, where you can view them again." : pick.denom.label}</DialogDescription>
        </DialogHeader>

        {codes ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold"><CheckCircle2 className="h-4 w-4" />{npr(total)} paid from your wallet</div>
            <CodeList codes={codes} />
            <Button className={`w-full h-10 rounded-xl ${primaryBtn}`} onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`${amberCard} p-4 space-y-3`}>
              <div className="flex items-center justify-between text-sm"><span className="text-[#4B5563]">Price</span><span className="font-bold text-[#1F2937]">{npr(pick.denom.pricePaisa)}</span></div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4B5563]">Quantity <span className="text-xs">({pick.denom.available} in stock)</span></span>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8 bg-white" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Fewer"><Minus className="h-3.5 w-3.5" /></Button>
                  <span className="w-6 text-center font-bold">{qty}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8 bg-white" disabled={qty >= max} onClick={() => setQty(qty + 1)} aria-label="More"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[#F59E0B]/20 pt-3"><span className="font-semibold text-[#1F2937]">Total</span><span className="text-lg font-bold text-[#7E3AF2]">{npr(total)}</span></div>
              <p className={`text-xs ${short ? "text-red-600 font-semibold" : "text-[#6B7280]"}`}>Available to spend: {npr(availablePaisa)}{short ? " (not enough)" : ""}</p>
            </div>
            <Button className={`w-full h-11 rounded-xl ${primaryBtn}`} disabled={busy || short || max < 1} onClick={buy}>
              {busy ? "Placing order…" : `Pay ${npr(total)} from wallet`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Lets the merchant use their own product code and name; the API then accepts { "sku": "..." }. */
function SkuDialog({ pick, onClose, onSaved }: { pick: Pick | null; onClose: () => void; onSaved: () => void }) {
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setSku(pick?.denom.mySku || "")
    setName(pick?.denom.displayName || "")
  }, [pick])
  if (!pick) return null
  const save = async (clear = false) => {
    setBusy(true)
    const res = await saveMerchantSkuAction(pick.product.id, pick.denom.id, clear ? "" : sku, clear ? "" : name)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(clear ? "Removed" : "Saved")
    onSaved()
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1F2937]">Your own SKU and name (optional)</DialogTitle>
          <DialogDescription className="text-xs text-[#4B5563]">{pick.product.name} · {pick.denom.label}. Byiora SKU: {pick.denom.sku}. You can always order with that. Add your own code only if your store already uses its own SKUs.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-[#1F2937]">Your own SKU</span>
            <Input value={sku} onChange={(e) => setSku(e.target.value.replace(/[^A-Za-z0-9._-]/g, ""))} maxLength={64} placeholder="e.g. GPLAY-100" className={`${inputCls} font-mono`} />
            <span className="text-xs text-[#6B7280]">Letters, digits, dot, _ and -. Must be unique in your account.</span>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-[#1F2937]">Your product name (optional)</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Google Play ₹100 (India)" className={inputCls} />
          </label>
          {sku && <p className="text-xs text-[#4B5563] rounded-lg bg-[#FEF7E0] border border-[#F59E0B]/30 p-2.5 font-mono break-all">POST /orders {"{"} &quot;sku&quot;: &quot;{sku}&quot;, &quot;quantity&quot;: 1, … {"}"}</p>}
          <div className="flex gap-2 pt-1">
            {pick.denom.mySku && <Button variant="outline" disabled={busy} onClick={() => save(true)} className="h-10 bg-white border-red-300 text-red-700 hover:bg-red-50">Remove</Button>}
            <Button disabled={busy || !sku} onClick={() => save()} className={`flex-1 h-10 rounded-xl ${primaryBtn}`}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function MerchantCatalog() {
  const { state, refresh, tick } = useMerchantState()
  const [data, setData] = useState<{ products: CatalogItem[]; availablePaisa: number; manualDelivery: boolean; comingSoon: { id: string; name: string; logo: string | null }[] } | null>(null)
  const [q, setQ] = useState("")
  const [stockOnly, setStockOnly] = useState(false)
  const [pick, setPick] = useState<Pick | null>(null)
  const [skuFor, setSkuFor] = useState<Pick | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = () => getPricedCatalogAction().then((d) => setData(d || { products: [], availablePaisa: 0, manualDelivery: false, comingSoon: [] }))
  useEffect(() => { load() }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data?.products || [])
      .map((p) => ({ ...p, denominations: stockOnly ? p.denominations.filter((d) => d.available > 0) : p.denominations }))
      .filter((p) => p.denominations.length && (!needle || p.name.toLowerCase().includes(needle)))
  }, [data, q, stockOnly])
  const paged = usePaged(shown)

  if (!data) return <Spinner label="Loading catalog..." />

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Catalog" subtitle="Your prices, live stock, instant delivery." />
      <LockedNote show={!state.canUse} />

      <Card className={`${amberCard} overflow-hidden`}>
        <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 space-y-0">
          <div>
            <CardTitle className="text-[#1F2937] text-lg font-bold">Products ({shown.length})</CardTitle>
            <CardDescription className="text-[#92400E]">Click an amount to buy</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <label className="inline-flex items-center gap-2 text-sm text-[#92400E] font-semibold cursor-pointer select-none">
              <input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)} className="h-4 w-4 accent-[#7E3AF2]" />
              In stock only
            </label>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} pl-9`} aria-label="Search products" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {shown.length === 0 ? (
            <p className="text-center text-sm text-[#4B5563] py-12">{data.products.length ? "No products match." : "No products are available to you yet."}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {paged.pageItems.map((p) => {
                  const isOpen = !!open[p.id]
                  return (
                    <div key={p.id} className="rounded-xl border border-[#F59E0B]/20 bg-white p-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {p.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.logo} alt="" width={44} height={44} className="h-11 w-11 rounded-lg object-contain bg-[#F9FAFB] border border-gray-100 shrink-0" loading="lazy" />
                          ) : (
                            <div className="h-11 w-11 rounded-lg bg-purple-50 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-[#1F2937] truncate">{p.name}</p>
                            <p className="text-xs text-[#92400E] capitalize">{p.category.replace(/-/g, " ")}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          className="flex h-9 items-center justify-between gap-2.5 rounded-xl border-2 border-[#F59E0B]/30 bg-white px-3 py-1.5 text-xs sm:text-sm text-[#1F2937] hover:border-[#F59E0B] focus:outline-none transition-colors shadow-xs shrink-0 cursor-pointer"
                        >
                          <span className="font-medium text-[#1F2937] whitespace-nowrap">
                            {isOpen ? "Hide denominations" : "Show denominations"} ({p.denominations.length})
                          </span>
                          <ChevronDown className={`h-4 w-4 text-[#92400E] opacity-75 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      {isOpen && (
                        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 mt-2">
                          {p.denominations.map((d) => {
                            const can = state.canUse && d.available > 0
                            return (
                              <div key={d.id} className="flex items-stretch hover:bg-[#F5F0FB]">
                                <button
                                  type="button"
                                  disabled={!can}
                                  onClick={() => setPick({ product: p, denom: d })}
                                  className="flex-1 min-w-0 flex items-center justify-between gap-3 px-3 py-2.5 text-left disabled:cursor-not-allowed"
                                >
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-[#1F2937] truncate">{d.displayName || d.label}</span>
                                    <span className="block text-xs text-[#6B7280] truncate">
                                      {d.displayName ? `${d.label} · ` : ""}
                                      <span className={d.available ? "text-emerald-600" : "text-gray-400"}>{d.available ? `${d.available} in stock` : data.manualDelivery ? "Delivery delay" : "Out of stock"}</span>
                                    </span>
                                    <span className="flex flex-wrap gap-1 mt-0.5">
                                      {d.sku && <span className="font-mono text-[11px] text-[#374151] bg-gray-50 border border-gray-200 rounded px-1.5" title="Byiora SKU">{d.sku}</span>}
                                      {d.mySku && <span className="font-mono text-[11px] text-[#7E3AF2] bg-purple-50 border border-purple-200 rounded px-1.5" title="Your SKU">{d.mySku}</span>}
                                    </span>
                                  </span>
                                  <span className="text-sm font-bold text-[#7E3AF2] shrink-0">{npr(d.pricePaisa)}</span>
                                </button>
                                <button type="button" onClick={() => setSkuFor({ product: p, denom: d })} className="px-2.5 text-[#6B7280] hover:text-[#7E3AF2] border-l border-gray-100" title="Your own SKU and name" aria-label={`Set your SKU and name for ${d.label}`}>
                                  <Tag className="h-4 w-4" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <Pager page={paged.page} total={paged.total} onPage={paged.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {data.comingSoon.length > 0 && (
        <Card className={`${amberCard} overflow-hidden`}>
          <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-[#1F2937] text-lg font-bold">Game top-ups</CardTitle>
              <CardDescription className="text-[#92400E]">Top-ups to a player ID are coming soon for merchants.</CardDescription>
            </div>
            <span className="inline-flex px-2.5 py-1 rounded-full bg-purple-100 border border-purple-300 text-purple-900 text-xs font-bold whitespace-nowrap">Coming soon</span>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-disabled="true">
              {data.comingSoon.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 opacity-60 cursor-not-allowed select-none">
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-contain bg-[#F9FAFB] border border-gray-100 shrink-0 grayscale" loading="lazy" />
                  ) : <div className="h-10 w-10 rounded-lg bg-gray-100 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1F2937] truncate">{t.name}</p>
                    <p className="text-xs text-[#6B7280]">Coming soon</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <BuyDialog pick={pick} availablePaisa={data.availablePaisa} onClose={() => setPick(null)} onBought={() => { refresh(); load() }} />
      <SkuDialog pick={skuFor} onClose={() => setSkuFor(null)} onSaved={load} />
    </div>
  )
}
