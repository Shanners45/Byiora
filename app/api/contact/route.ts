import { NextResponse } from 'next/server'
import { sanitizeHtml } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/captcha'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const rl = await rateLimit(`contact:${ip}`, { windowMs: 60_000, max: 5 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid or empty JSON body" }, { status: 400 })
    }
    const { name, email, subject, message, captchaToken } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // SECURITY: Verify Turnstile captcha to prevent spam bots
    if (!captchaToken) {
      return NextResponse.json({ error: 'Captcha verification required' }, { status: 400 })
    }
    const captchaOk = await verifyTurnstileToken(captchaToken, ip)
    if (!captchaOk) {
      return NextResponse.json({ error: 'Captcha validation failed. Please try again.' }, { status: 403 })
    }

    const emailStr = String(email).trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailStr)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const sanitizedName = sanitizeHtml(name)
    const sanitizedEmail = sanitizeHtml(email)
    const sanitizedSubject = sanitizeHtml(subject || "New Support Request")
    const sanitizedMessage = sanitizeHtml(message)

    const { createServiceRoleClient } = await import("@/lib/supabase/service-role")
    const supabase = createServiceRoleClient() as any
    const normalizedEmail = sanitizedEmail.trim().toLowerCase()

    // Check if customer already has an active ongoing ticket (Open or Replied)
    const { data: existingTicket } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, replies, status")
      .ilike("email", normalizedEmail)
      .in("status", ["open", "replied"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingTicket) {
      // Append follow-up customer message to existing conversation thread
      const nowIso = new Date().toISOString()
      const currentReplies = Array.isArray(existingTicket.replies) ? existingTicket.replies : []
      const updatedReplies = [
        ...currentReplies,
        {
          reply: sanitizedMessage,
          reply_by: sanitizedName,
          replied_at: nowIso,
          sender: "customer",
        },
      ]

      const { error: updateErr } = await supabase
        .from("support_tickets")
        .update({
          status: "open", // Reopen/flag for admin attention
          replies: updatedReplies,
        })
        .eq("id", existingTicket.id)

      if (updateErr) {
        console.error("Failed to append follow-up message to support ticket:", updateErr.message)
        return NextResponse.json({ error: "Failed to submit ticket" }, { status: 500 })
      }

      return NextResponse.json({ success: true, ticketNumber: existingTicket.ticket_number })
    }

    // Otherwise, create a brand new ticket
    const ticketNumber = `BYI-TICK-${Math.floor(1000 + Math.random() * 9000)}`
    const { error: dbErr } = await supabase.from("support_tickets").insert({
      ticket_number: ticketNumber,
      name: sanitizedName,
      email: sanitizedEmail,
      subject: sanitizedSubject,
      message: sanitizedMessage,
      status: "open",
      created_at: new Date().toISOString(),
      replies: [],
    })

    if (dbErr) {
      console.error("Failed to insert support ticket into Supabase:", dbErr.message)
      return NextResponse.json({ error: "Failed to submit ticket" }, { status: 500 })
    }

    return NextResponse.json({ success: true, ticketNumber })
  } catch (error) {
    console.error('Error submitting contact ticket:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
