import type { NextRequest } from "next/server"
import { apiOk, authenticateApi, rupees } from "@/lib/merchant/api"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req)
  if (!("merchant" in auth)) return auth
  const m = auth.merchant
  // Test mode reports a fixed virtual balance.
  if (auth.test) return apiOk({ livemode: false, currency: "NPR", balance: 100000, credit_limit: 0, available: 100000 })
  return apiOk({ livemode: true, currency: "NPR", balance: rupees(m.wallet_balance_paisa), credit_limit: rupees(m.credit_limit_paisa), available: rupees(m.wallet_balance_paisa + m.credit_limit_paisa) })
}
