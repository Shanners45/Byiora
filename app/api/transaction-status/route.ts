import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Lightweight read-only endpoint to support client-side polling
 * of a transaction's status (used for static-QR auto-detection on the
 * checkout page, where there is no bank proxy to verify against).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    // SECURITY: Rate limit to prevent enumeration attacks (60 req/min per IP)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const rl = await rateLimit(`txn-status:${ip}`, { windowMs: 60_000, max: 60 })
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("transactions")
      .select("status, failure_remarks, transaction_id")
      .eq("transaction_id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      status: (data as any).status,
      failure_remarks: (data as any).failure_remarks
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 })
  }
}
