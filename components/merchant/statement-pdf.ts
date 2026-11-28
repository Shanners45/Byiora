"use client"

import type { MonthlyStatement } from "@/lib/merchant/reports"
import { SELLER } from "@/lib/seller"

const KIND: Record<string, string> = { topup: "Wallet top-up", order: "Order", refund: "Refund", adjustment: "Adjustment" }
// jsPDF's built-in fonts have no rupee sign, so amounts use "Rs.".
const money = (paisa: number) => `${paisa < 0 ? "-" : ""}Rs. ${(Math.abs(paisa) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logo-final.png")
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Builds and downloads the monthly wallet statement as a PDF. */
export async function downloadStatementPdf(st: MonthlyStatement) {
  const [
    { jsPDF },
    { default: autoTable },
    base64Logo,
  ] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadLogoBase64(),
  ])
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const monthName = new Date(`${st.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

  doc.setFillColor(90, 53, 136)
  doc.rect(0, 0, W, 78, "F")
  doc.setTextColor(255, 255, 255)
  if (base64Logo && base64Logo.startsWith("data:image")) {
    // logo-final.png is 423x138 (aspect ratio ~3.065)
    doc.addImage(base64Logo, "PNG", 40, 16, 80, 26)
    doc.setFont("helvetica", "normal").setFontSize(9).text("Merchant wallet statement", 40, 58)
  } else {
    doc.setFont("helvetica", "bold").setFontSize(20).text("BYIORA", 40, 42)
    doc.setFont("helvetica", "normal").setFontSize(9).text("Merchant wallet statement", 40, 58)
  }
  doc.setFont("helvetica", "bold").setFontSize(13).text(monthName, W - 40, 42, { align: "right" })
  doc.setFont("helvetica", "normal").setFontSize(8).text(`Times shown in ${st.timeZone}`, W - 40, 58, { align: "right" })

  doc.setTextColor(31, 41, 55)
  doc.setFont("helvetica", "bold").setFontSize(10).text("Issued by", 40, 108).text("Statement for", W / 2 + 10, 108)
  doc.setFont("helvetica", "normal").setFontSize(9)
  const issuedByLines = [SELLER.name, `PAN ${SELLER.pan}`, SELLER.address, SELLER.phone, SELLER.email, SELLER.website]
  issuedByLines.forEach((l, i) => doc.text(l, 40, 124 + i * 13))
  const m = st.merchant
  ;[m.legalName || m.businessName, m.pan ? `PAN / VAT ${m.pan}` : null, m.address, m.email, m.phone].filter(Boolean).forEach((l, i) => doc.text(doc.splitTextToSize(String(l), W / 2 - 50)[0], W / 2 + 10, 124 + i * 13))

  autoTable(doc, {
    startY: 215,
    theme: "grid",
    head: [["Opening balance", "Money in", "Money out", "Closing balance", "Orders", "Codes"]],
    body: [[money(st.openingPaisa), money(st.creditsPaisa), money(st.debitsPaisa), money(st.closingPaisa), String(st.orders), String(st.codes)]],
    headStyles: { fillColor: [254, 247, 224], textColor: [146, 64, 14], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontStyle: "bold", fontSize: 10 },
    margin: { left: 40, right: 40 },
  })

  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: st.timeZone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    theme: "striped",
    head: [["Date", "Type", "Reference", "Amount", "Balance"]],
    body: st.rows.length
      ? st.rows.map((r) => [fmt.format(new Date(r.date)), KIND[r.kind] || r.kind, (r.note || r.reference || "").slice(0, 48), money(r.amountPaisa), money(r.balanceAfterPaisa)])
      : [[{ content: "No wallet activity this month.", colSpan: 5, styles: { halign: "center" } }]],
    headStyles: { fillColor: [126, 58, 242], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const H = doc.internal.pageSize.getHeight()
      doc.setFontSize(7).setTextColor(107, 114, 128)
      doc.text(`Generated ${new Date().toISOString().slice(0, 10)} · This statement is computer generated and needs no signature.`, 40, H - 24)
      doc.text(`Page ${doc.getNumberOfPages()}`, W - 40, H - 24, { align: "right" })
    },
  })

  doc.save(`byiora-statement-${st.month}-${m.businessName.replace(/\W+/g, "-").toLowerCase()}.pdf`)
}

/** Up to 24 recent months (newest first) as YYYY-MM in the viewer's calendar, never before `since`. */
export function recentMonths(since?: string | null): { value: string; label: string }[] {
  const now = new Date()
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (since && value < since.slice(0, 7)) break
    out.push({ value, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }) })
  }
  return out
}

export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
