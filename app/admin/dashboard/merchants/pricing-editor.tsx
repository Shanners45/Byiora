"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Search, Save, Undo2, EyeOff, Eye, Percent, Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { getMerchantPriceBookAction, saveMerchantPriceRulesAction, setMerchantCatalogModeAction, type RuleInput } from "@/app/actions/merchant-admin"
import type { PriceBookLine } from "@/lib/merchant/trade"
import { resolvePrice, ruleKey, type PriceRule } from "@/lib/merchant/pricing"
import { amberCard, inputCls, npr, pill } from "./shared"
import { Pager, usePaged } from "@/components/merchant/pager"

type Draft = { visible: boolean | null; discount: string; fixed: string }
const EMPTY: Draft = { visible: null, discount: "", fixed: "" }
const toDraft = (r: PriceRule | null): Draft => (r ? { visible: r.visible, discount: r.discount_percent == null ? "" : String(r.discount_percent), fixed: r.fixed_price_paisa ? String(r.fixed_price_paisa / 100) : "" } : EMPTY)
const same = (a: Draft, b: Draft) => a.visible === b.visible && a.discount.trim() === b.discount.trim() && a.fixed.trim() === b.fixed.trim()
const SOURCE: Record<string, string> = { fixed: "Fixed price", amount_discount: "Amount discount", product_discount: "Product discount", merchant_discount: "Default discount" }

type Product = { id: string; name: string; category: string; logo: string | null; globallyEnabled: boolean; lines: PriceBookLine[] }

export function PricingEditor({ merchantId, refreshKey }: { merchantId: string; refreshKey: number }) {
  const [book, setBook] = useState<{ lines: PriceBookLine[]; catalogMode: "all" | "selected"; discountPercent: number } | null>(null)
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map())
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("all")
  const [category, setCategory] = useState("all")
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDiscount, setBulkDiscount] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await getMerchantPriceBookAction(merchantId)
    if (!res.success) return toast.error(res.error)
    setBook({ lines: res.lines, catalogMode: res.catalogMode, discountPercent: res.discountPercent })
  }, [merchantId])
  useEffect(() => { load() }, [load, refreshKey])

  // Saved rules from the server, keyed like the database.
  const saved = useMemo(() => {
    const m = new Map<string, Draft>()
    for (const l of book?.lines || []) {
      m.set(ruleKey(l.productId, l.label), toDraft(l.rule))
      m.set(ruleKey(l.productId, ""), toDraft(l.productRule))
    }
    return m
  }, [book])
  const current = useCallback((key: string) => drafts.get(key) || saved.get(key) || EMPTY, [drafts, saved])
  const change = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => {
      const next = new Map(d)
      const v = { ...(d.get(key) || saved.get(key) || EMPTY), ...patch }
      if (same(v, saved.get(key) || EMPTY)) next.delete(key)
      else next.set(key, v)
      return next
    })

  const products = useMemo<Product[]>(() => {
    const map = new Map<string, Product>()
    for (const l of book?.lines || []) {
      const p = map.get(l.productId) || { id: l.productId, name: l.productName, category: l.category, logo: l.logo, globallyEnabled: l.globallyEnabled, lines: [] }
      p.lines.push(l)
      map.set(l.productId, p)
    }
    return [...map.values()]
  }, [book])

  // Live preview with the staged (unsaved) rules.
  const preview = useCallback(
    (p: Product, l: PriceBookLine) => {
      if (!book) return { visible: false, pricePaisa: 0, source: "merchant_discount" as const }
      const asRule = (label: string): PriceRule => {
        const d = current(ruleKey(p.id, label))
        return { product_id: p.id, denomination_label: label, visible: d.visible, discount_percent: d.discount.trim() === "" ? null : Number(d.discount), fixed_price_paisa: d.fixed.trim() === "" ? null : Math.round(Number(d.fixed) * 100) }
      }
      const rules = new Map([[ruleKey(p.id, ""), asRule("")], [ruleKey(p.id, l.label), asRule(l.label)]])
      return resolvePrice({ discount_percent: book.discountPercent, catalog_mode: book.catalogMode }, p.id, l.label, l.retailPaisa, p.globallyEnabled, rules)
    },
    [book, current],
  )

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return products.filter((p) => {
      if (needle && !p.name.toLowerCase().includes(needle)) return false
      if (category !== "all" && p.category !== category) return false
      const anyVisible = p.lines.some((l) => preview(p, l).visible)
      if (filter === "visible") return anyVisible
      if (filter === "hidden") return !anyVisible
      if (filter === "custom") return p.lines.some((l) => preview(p, l).source !== "merchant_discount")
      if (filter === "disabled") return !p.globallyEnabled
      return true
    })
  }, [products, q, category, filter, preview])
  const paged = usePaged(shown)

  if (!book) return <p className="text-sm text-[#4B5563] text-center py-10">Loading prices...</p>

  const productVisible = (p: Product) => (book.catalogMode === "selected" ? current(ruleKey(p.id, "")).visible === true : current(ruleKey(p.id, "")).visible !== false)
  const setProductVisible = (pid: string, on: boolean) => change(ruleKey(pid, ""), { visible: book.catalogMode === "selected" ? (on ? true : null) : on ? null : false })

  const bulk = (fn: (p: Product) => void) => {
    const targets = products.filter((p) => selected.has(p.id))
    if (!targets.length) return toast.error("Select products first.")
    targets.forEach(fn)
  }
  const clearProduct = (p: Product) => {
    change(ruleKey(p.id, ""), { ...EMPTY })
    p.lines.forEach((l) => change(ruleKey(p.id, l.label), { ...EMPTY }))
  }

  const save = async () => {
    const rules: RuleInput[] = []
    for (const [key, d] of drafts) {
      const [productId, label] = key.split("\u0000")
      if (d.discount.trim() !== "" && !(Number(d.discount) >= 0 && Number(d.discount) <= 90)) return toast.error("Discounts must be between 0% and 90%.")
      if (d.fixed.trim() !== "" && !(Number(d.fixed) > 0)) return toast.error("Fixed prices must be above zero.")
      rules.push({ productId, label, visible: d.visible, discountPercent: d.discount.trim() === "" ? null : Number(d.discount), fixedPriceRupees: d.fixed.trim() === "" ? null : Number(d.fixed) })
    }
    setSaving(true)
    const res = await saveMerchantPriceRulesAction(merchantId, rules)
    setSaving(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`Saved ${rules.length} change${rules.length === 1 ? "" : "s"}. The merchant sees them now.`)
    setDrafts(new Map())
    load()
  }
  const setMode = async (mode: "all" | "selected") => {
    if (mode === book.catalogMode) return
    if (drafts.size && !window.confirm("You have unsaved changes. Switch anyway? They stay staged.")) return
    const res = await setMerchantCatalogModeAction(merchantId, mode)
    if (!res.success) return toast.error(res.error)
    toast.success(mode === "all" ? "Merchant now sees every merchant product unless hidden." : "Merchant now sees only the products you switch on.")
    load()
  }

  const visibleCount = products.filter((p) => p.lines.some((l) => preview(p, l).visible)).length
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id))

  return (
    <div className="space-y-4">
      <div className={`${amberCard} p-4 grid grid-cols-1 md:grid-cols-2 gap-4`}>
        <div>
          <p className="text-sm font-bold text-[#1F2937]">Which products this merchant sees</p>
          <div className="mt-2 inline-flex rounded-lg border-2 border-[#F59E0B]/30 bg-white p-1 gap-1">
            {(["all", "selected"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setMode(mode)} className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold ${book.catalogMode === mode ? "bg-[#F59E0B] text-white" : "text-[#92400E] hover:bg-[#FEF7E0]"}`}>
                {mode === "all" ? "All merchant products" : "Only selected products"}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#4B5563] mt-2">{book.catalogMode === "all" ? "Every product enabled for merchants, except ones you hide below." : "Nothing is shown until you switch a product on below."}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/90 rounded-lg p-3 border border-[#F59E0B]/20"><span className="text-[11px] text-[#92400E] font-medium block">Products visible</span><span className="text-lg font-bold text-[#1F2937]">{visibleCount} / {products.length}</span></div>
          <div className="bg-white/90 rounded-lg p-3 border border-[#F59E0B]/20"><span className="text-[11px] text-[#92400E] font-medium block">Default discount</span><span className="text-lg font-bold text-[#1F2937]">{book.discountPercent}%</span><span className="block text-[11px] text-[#6B7280]">Change in Wallet &amp; pricing</span></div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-10 pl-9 bg-white`} aria-label="Search products" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`h-10 border px-3 text-sm bg-white ${inputCls}`} aria-label="Filter">
          <option value="all">All products</option>
          <option value="visible">Visible to merchant</option>
          <option value="hidden">Hidden from merchant</option>
          <option value="custom">Custom prices</option>
          <option value="disabled">Not enabled for merchants</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`h-10 border px-3 text-sm bg-white capitalize ${inputCls}`} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c.replace(/-/g, " ")}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-purple-200 bg-purple-50 p-3">
          <span className="text-sm font-bold text-purple-900 mr-1">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => bulk((p) => setProductVisible(p.id, true))}><Eye className="h-3.5 w-3.5 mr-1" />Show</Button>
          <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => bulk((p) => setProductVisible(p.id, false))}><EyeOff className="h-3.5 w-3.5 mr-1" />Hide</Button>
          <div className="flex items-center gap-1">
            <Input value={bulkDiscount} onChange={(e) => setBulkDiscount(e.target.value)} placeholder="%" type="number" min={0} max={90} className={`${inputCls} h-8 w-20 bg-white text-center text-sm rounded-lg`} aria-label="Discount percent" />
            <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => bulk((p) => change(ruleKey(p.id, ""), { discount: bulkDiscount }))}><Percent className="h-3.5 w-3.5 mr-1" />Set discount</Button>
          </div>
          <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => bulk(clearProduct)}><Eraser className="h-3.5 w-3.5 mr-1" />Reset to defaults</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
      )}

      <div className="rounded-xl border border-[#F59E0B]/20 bg-white overflow-hidden">
        <div className="grid grid-cols-[28px_1fr] sm:grid-cols-[28px_1fr_120px_130px_28px] items-center gap-2 px-3 py-2.5 bg-[#FEF7E0]/60 border-b border-[#F59E0B]/20 text-[11px] font-bold uppercase tracking-wider text-[#1F2937]">
          <input type="checkbox" aria-label="Select all shown" checked={allShownSelected} onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((p) => p.id)) : new Set())} className="h-4 w-4 accent-[#7E3AF2]" />
          <span>Product ({shown.length})</span>
          <span className="hidden sm:block">Visible</span>
          <span className="hidden sm:block">Product discount</span>
          <span className="hidden sm:block" />
        </div>
        {shown.length === 0 && <p className="text-center text-sm text-[#4B5563] py-10">No products match.</p>}
        <div className="divide-y divide-gray-100">
          {paged.pageItems.map((p) => {
            const isOpen = open.has(p.id)
            const pd = current(ruleKey(p.id, ""))
            const dirtyCount = [ruleKey(p.id, ""), ...p.lines.map((l) => ruleKey(p.id, l.label))].filter((k) => drafts.has(k)).length
            return (
              <div key={p.id}>
                <div className={`grid grid-cols-[28px_1fr_28px] sm:grid-cols-[28px_1fr_120px_130px_28px] items-center gap-x-2 gap-y-2.5 px-3 py-3 sm:py-2.5 ${dirtyCount ? "bg-purple-50/50" : ""}`}>
                  <input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n })} className="h-4 w-4 accent-[#7E3AF2]" />
                  <button type="button" onClick={() => setOpen((s) => { const n = new Set(s); isOpen ? n.delete(p.id) : n.add(p.id); return n })} className="flex items-center gap-3 min-w-0 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.logo ? <img src={p.logo} alt="" width={32} height={32} className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg object-contain p-1 bg-[#F9FAFB] border border-gray-100 shrink-0" loading="lazy" /> : <div className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg bg-purple-50 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#1F2937] truncate">{p.name}</span>
                      <span className="block text-[11px] text-[#6B7280] capitalize truncate">
                        {p.category.replace(/-/g, " ")} · {p.lines.length} amount{p.lines.length === 1 ? "" : "s"}
                        {!p.globallyEnabled && <span className="text-red-600 font-semibold"> · Not enabled for merchants</span>}
                        {dirtyCount > 0 && <span className="text-[#7E3AF2] font-semibold"> · {dirtyCount} unsaved</span>}
                      </span>
                    </span>
                  </button>
                  {/* Phones: visibility and discount on their own line under the name; wider screens: their own columns. */}
                  <div className="order-last col-start-2 col-span-2 flex items-center gap-3 sm:order-none sm:contents">
                  <label className="flex items-center gap-2 shrink-0">
                    <Switch checked={productVisible(p)} onCheckedChange={(on) => setProductVisible(p.id, on)} aria-label={`Show ${p.name} to this merchant`} />
                    <span className="text-xs font-semibold text-[#4B5563] sm:hidden">Visible</span>
                  </label>
                  <Input value={pd.discount} onChange={(e) => change(ruleKey(p.id, ""), { discount: e.target.value })} placeholder={`${book.discountPercent}% default`} type="number" min={0} max={90} step="0.01" className={`${inputCls} h-9 sm:h-8 flex-1 min-w-0 text-sm bg-white rounded-lg placeholder:text-gray-400`} aria-label={`${p.name} discount percent`} />
                  </div>
                  <button type="button" aria-label={isOpen ? "Collapse" : "Expand"} onClick={() => setOpen((s) => { const n = new Set(s); isOpen ? n.delete(p.id) : n.add(p.id); return n })} className="text-[#6B7280]">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="bg-[#F9FAFB] border-t border-gray-100 px-3 py-2 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-[#6B7280]">
                          <th className="text-left font-bold py-1.5">Amount</th>
                          <th className="text-left font-bold">Retail</th>
                          <th className="text-left font-bold">Stock</th>
                          <th className="text-left font-bold">Show</th>
                          <th className="text-left font-bold">Discount %</th>
                          <th className="text-left font-bold">Fixed price (Rs.)</th>
                          <th className="text-left font-bold">Merchant pays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.lines.map((l) => {
                          const k = ruleKey(p.id, l.label)
                          const d = current(k)
                          const pv = preview(p, l)
                          const margin = l.retailPaisa ? Math.round(((l.retailPaisa - pv.pricePaisa) / l.retailPaisa) * 1000) / 10 : 0
                          return (
                            <tr key={l.label} className={`border-t border-gray-100 ${drafts.has(k) ? "bg-purple-50/60" : ""}`}>
                              <td className="py-2 pr-2 font-medium text-[#1F2937]">{l.label}</td>
                              <td className="pr-2 text-[#4B5563]">{npr(l.retailPaisa)}</td>
                              <td className={`pr-2 ${l.available ? "text-emerald-600" : "text-gray-400"}`}>{l.available}</td>
                              <td className="pr-2"><Switch checked={d.visible !== false} onCheckedChange={(on) => change(k, { visible: on ? null : false })} aria-label={`Show ${l.label}`} /></td>
                              <td className="pr-2"><Input value={d.discount} onChange={(e) => change(k, { discount: e.target.value })} placeholder="—" type="number" min={0} max={90} step="0.01" className={`${inputCls} h-8 w-20 bg-white text-center text-sm rounded-lg placeholder:text-gray-400`} aria-label={`${l.label} discount`} /></td>
                              <td className="pr-2"><Input value={d.fixed} onChange={(e) => change(k, { fixed: e.target.value })} placeholder="—" type="number" min={0} step="0.01" className={`${inputCls} h-8 w-28 bg-white text-center text-sm rounded-lg placeholder:text-gray-400`} aria-label={`${l.label} fixed price`} /></td>
                              <td>
                                <span className={`font-bold ${pv.visible ? "text-[#7E3AF2]" : "text-gray-400 line-through"}`}>{npr(pv.pricePaisa)}</span>
                                <span className="block text-[11px] text-[#6B7280]">{SOURCE[pv.source]} · {margin >= 0 ? `${margin}% off retail` : <span className="text-red-600 font-semibold">{Math.abs(margin)}% above retail</span>}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Pager page={paged.page} total={paged.total} onPage={paged.setPage} />

      {drafts.size > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-col sm:flex-row items-center justify-between gap-2 rounded-xl border-2 border-[#7E3AF2] bg-white p-3 shadow-lg">
          <span className="text-sm font-bold text-[#1F2937]">{drafts.size} unsaved change{drafts.size === 1 ? "" : "s"}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={() => setDrafts(new Map())} disabled={saving}><Undo2 className="h-4 w-4 mr-1.5" />Discard</Button>
            <Button size="sm" className="h-9 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      )}
      {pill(["Tip", "bg-slate-100 text-slate-700 border-slate-300"])} <span className="text-xs text-[#4B5563]">Leave a field empty to use the default. Price order: fixed price, then amount discount, then product discount, then the merchant&apos;s default discount.</span>
    </div>
  )
}
