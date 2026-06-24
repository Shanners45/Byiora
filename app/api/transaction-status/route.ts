import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

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

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("transactions")
      .select("status, transaction_id")
      .eq("transaction_id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ status: (data as any).status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 })
  }
}
