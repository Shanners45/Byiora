import type { NextRequest } from "next/server"
import { apiOk, authenticateApi, rupees } from "@/lib/merchant/api"
import { loadPricedCatalog } from "@/lib/merchant/trade"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req)
  if (!("merchant" in auth)) return auth
  const products = await loadPricedCatalog(auth.merchant)
  return apiOk({
    currency: "NPR",
    products: products
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        denominations: p.denominations.map((d) => ({ sku: d.sku, denomination_id: d.id, denomination: d.label, merchant_sku: d.mySku, display_name: d.displayName, price: rupees(d.pricePaisa), in_stock: auth.test ? Math.max(d.available, 20) : d.available })),
      }))
      .filter((p) => p.denominations.length),
  })
}
