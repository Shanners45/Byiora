import { NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs"
import { deliverWebhook } from "@/lib/merchant/events"

// QStash calls this for each merchant webhook delivery; a 500 makes QStash retry with backoff.
async function handler(req: Request) {
  const { deliveryId } = await req.json().catch(() => ({}))
  if (typeof deliveryId !== "string") return NextResponse.json({ error: "Missing deliveryId" }, { status: 400 })
  const ok = await deliverWebhook(deliveryId)
  return ok ? NextResponse.json({ delivered: true }) : NextResponse.json({ error: "Merchant endpoint did not accept" }, { status: 500 })
}

export const POST = process.env.NODE_ENV === "development" ? handler : verifySignatureAppRouter(handler)
