import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { fulfillOrderDirectly, handlePartialPayment } from "@/lib/fulfillment"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pidx = searchParams.get("pidx")
  const purchase_order_id = searchParams.get("purchase_order_id")
  const status = searchParams.get("status")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (!pidx || !purchase_order_id) {
    return NextResponse.redirect(`${siteUrl}/?error=missing_params`)
  }

  try {
    const supabase = createServiceRoleClient()

    // 1. Fetch transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", purchase_order_id)
      .single()

    if (txnError || !txn) {
      console.error(`[KHALTI] Transaction not found: ${purchase_order_id}`)
      return NextResponse.redirect(`${siteUrl}/?error=txn_not_found`)
    }

    const isGuest = !txn.user_id
    const successRedirect = isGuest
      ? `${siteUrl}/?paid=success`
      : `${siteUrl}/transactions?paid=success`
    const failRedirect = isGuest
      ? `${siteUrl}/`
      : `${siteUrl}/transactions`

    // Already completed/paid? Redirect to success.
    if (txn.status === "Completed" || txn.status === "Paid") {
      return NextResponse.redirect(successRedirect)
    }

    // If Khalti sent back a cancelled/failed status in the query param, handle it immediately
    if (status === "User canceled") {
      await supabase
        .from("transactions")
        .update({
          status: "Payment Failed",
          failure_remarks: "Khalti: User canceled payment",
          updated_at: new Date().toISOString()
        } as any)
        .eq("transaction_id", purchase_order_id)
      return NextResponse.redirect(failRedirect)
    }

    // 2. Fetch Khalti credentials
    const credsRes = await supabase.from("payment_credentials").select("encrypted_username").eq("provider", "khalti").single() as any
    if (!credsRes.data || !credsRes.data.encrypted_username) {
      console.error(`[KHALTI] Credentials not found`)
      return NextResponse.redirect(failRedirect)
    }

    const secretKey = (await decryptBankCredentials(credsRes.data.encrypted_username))?.trim()
    if (!secretKey) {
      console.error(`[KHALTI] Failed to decrypt secret key`)
      return NextResponse.redirect(failRedirect)
    }

    // 3. Verify with Khalti Lookup API
    const isLive = secretKey.toLowerCase().startsWith("live_")
    const lookupUrl = isLive 
      ? "https://khalti.com/api/v2/epayment/lookup/" 
      : "https://dev.khalti.com/api/v2/epayment/lookup/"

    console.log(`[KHALTI] Verifying pidx=${pidx} for txn=${purchase_order_id}`)

    const authHeader = secretKey.startsWith("Key ") ? secretKey : `Key ${secretKey}`

    const makeLookupCall = async (targetUrl: string) => {
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ pidx })
      })
      const data = await resp.json().catch(() => ({}))
      return { ok: resp.ok, status: resp.status, data }
    }

    let verifyRes = await makeLookupCall(lookupUrl)

    if (!verifyRes.ok && (verifyRes.status === 401 || verifyRes.status === 404)) {
      const alternateLookupUrl = lookupUrl.includes("dev.khalti.com")
        ? "https://khalti.com/api/v2/epayment/lookup/"
        : "https://dev.khalti.com/api/v2/epayment/lookup/"
      console.log(`[KHALTI LOOKUP] Retrying lookup with alternate URL: ${alternateLookupUrl}`)
      verifyRes = await makeLookupCall(alternateLookupUrl)
    }

    const verifyData = verifyRes.data
    console.log(`[KHALTI] Lookup response:`, verifyData.status, verifyData.transaction_id || verifyData.tidx || verifyData.idx)

    if (verifyData.status === "Completed") {
      // SECURITY: Validate paid amount against order price (Khalti returns total_amount in Paisa)
      const expectedPaisa = Math.round(Number(txn.price) * 100)
      const receivedPaisa = Number(verifyData.total_amount || verifyData.amount)
      if (receivedPaisa && receivedPaisa < expectedPaisa) {
        console.error(`[KHALTI FRAUD ALERT] Amount mismatch for ${purchase_order_id}: Expected ${expectedPaisa} Paisa, received ${receivedPaisa} Paisa`)
        await handlePartialPayment({
          transactionId: purchase_order_id,
          expectedAmount: Math.round(Number(txn.price)),
          paidAmount: Math.round(receivedPaisa / 100),
          productName: txn.product_name,
          userEmail: txn.user_email,
          source: "Khalti",
        })
        return NextResponse.redirect(failRedirect)
      }

      const resolvedBankTxnId = verifyData.transaction_id || verifyData.tidx || verifyData.bank_txn_id || verifyData.idx || pidx

      const fulfillResult = await fulfillOrderDirectly({
        transactionId: purchase_order_id,
        validationTraceId: pidx,
        provider: "khalti",
        bankTxnId: resolvedBankTxnId,
        source: "Khalti",
      })

      if (!fulfillResult.success) {
        console.error(`[KHALTI] Fulfillment failed for ${purchase_order_id}:`, fulfillResult.error)
        return NextResponse.redirect(failRedirect)
      }

      console.log(`[KHALTI] ✅ Successfully fulfilled order for ${purchase_order_id}`)
      return NextResponse.redirect(successRedirect)

    } else if (verifyData.status === "Refunded" || verifyData.status === "Expired" || verifyData.status === "User canceled") {
      await supabase
        .from("transactions")
        .update({
          status: "Payment Failed",
          failure_remarks: `Khalti status: ${verifyData.status}`,
          updated_at: new Date().toISOString()
        } as any)
        .eq("transaction_id", purchase_order_id)
        .in("status", ["Payment Pending", "Processing"])
      return NextResponse.redirect(failRedirect)

    } else if (verifyData.status === "Pending" || verifyData.status === "Initiated") {
      return NextResponse.redirect(failRedirect)
    }

    console.warn(`[KHALTI] Unknown status: ${verifyData.status}`)
    return NextResponse.redirect(failRedirect)

  } catch (error: any) {
    console.error("[KHALTI] Callback error:", error)
    return NextResponse.redirect(`${siteUrl}/`)
  }
}
