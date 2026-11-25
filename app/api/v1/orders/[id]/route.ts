import type { NextRequest } from "next/server"
import { apiError, apiOk, authenticateApi } from "@/lib/merchant/api"
import { merchantDb } from "@/lib/merchant/server"
import { byioraSkuFor, orderCodes } from "@/lib/merchant/trade"
import { orderWebhookData } from "@/lib/merchant/events"

export const dynamic = "force-dynamic"

/** One order with its codes. {id} is the order_id, or "ref:<client_ref>". */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(req)
  if (!("merchant" in auth)) return auth
  const { id } = await params

  let q = merchantDb().from("merchant_orders").select("*").eq("merchant_id", auth.merchant.id).eq("is_test", auth.test)
  if (id.startsWith("ref:")) q = q.eq("client_ref", `${auth.test ? "test-" : "api-"}${id.slice(4)}`)
  else if (/^[0-9a-f-]{36}$/i.test(id)) q = q.eq("id", id)
  else return apiError(404, "ORDER_NOT_FOUND", "No order with that ID.")
  const { data: o } = await q.maybeSingle()
  if (!o) return apiError(404, "ORDER_NOT_FOUND", "No order with that ID.")

  return apiOk({ ...orderWebhookData({ ...o, byiora_sku: await byioraSkuFor(o.product_id, o.denomination_id, o.denomination_label) }), livemode: !o.is_test, codes: o.status === "completed" ? await orderCodes(o.id) : [] })
}
