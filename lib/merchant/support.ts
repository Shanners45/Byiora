// Shared constants and shapes for merchant support (safe to import in the browser).

export const TICKET_CATEGORIES = {
  order: "Order or code problem",
  refund: "Refund request",
  wallet: "Wallet or top-up",
  limits: "Limits or credit",
  api: "API or integration",
  account: "Account or verification",
  other: "Something else",
} as const
export type TicketCategory = keyof typeof TICKET_CATEGORIES

export const TICKET_STATUS: Record<string, [string, string]> = {
  open: ["Open", "bg-purple-100 text-purple-900 border-purple-300"],
  awaiting_merchant: ["Waiting for you", "bg-amber-100 text-amber-900 border-amber-300"],
  resolved: ["Resolved", "bg-emerald-100 text-emerald-900 border-emerald-300"],
  closed: ["Closed", "bg-slate-100 text-slate-700 border-slate-300"],
}

export const TICKET_PRIORITY: Record<string, [string, string]> = {
  low: ["Low", "bg-slate-100 text-slate-700 border-slate-300"],
  normal: ["Normal", "bg-sky-100 text-sky-900 border-sky-300"],
  high: ["High", "bg-amber-100 text-amber-900 border-amber-300"],
  urgent: ["Urgent", "bg-red-100 text-red-800 border-red-300"],
}

export type TicketRow = {
  id: string
  number: number
  category: TicketCategory
  subject: string
  orderRef: string | null
  status: "open" | "awaiting_merchant" | "resolved" | "closed"
  priority: "low" | "normal" | "high" | "urgent"
  lastMessageAt: string
  lastMessageBy: "merchant" | "admin"
  createdAt: string
  merchantId?: string
  businessName?: string
}

export type TicketMessage = { id: number; authorType: "merchant" | "admin"; body: string; createdAt: string }

export const toTicketRow = (t: any): TicketRow => ({
  id: t.id,
  number: t.number,
  category: t.category,
  subject: t.subject,
  orderRef: t.order_ref,
  status: t.status,
  priority: t.priority,
  lastMessageAt: t.last_message_at,
  lastMessageBy: t.last_message_by,
  createdAt: t.created_at,
  merchantId: t.merchant_id,
  businessName: t.merchants?.business_name,
})
