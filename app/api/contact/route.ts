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
    const { contactFormSchema } = await import('@/lib/validations/contact')
    const parse = contactFormSchema.safeParse({
      name: body.name,
      email: body.email,
      subject: body.subject || "New Support Request",
      message: body.message,
      turnstileToken: body.captchaToken,
    })
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || "Invalid form submission." }, { status: 400 })
    }

    const { name, email, subject, message, captchaToken } = body

    // SECURITY: Verify Turnstile captcha to prevent spam bots
    if (!captchaToken) {
      return NextResponse.json({ error: 'Captcha verification required' }, { status: 400 })
    }
    const captchaOk = await verifyTurnstileToken(captchaToken, ip)
    if (!captchaOk) {
      return NextResponse.json({ error: 'Captcha validation failed. Please try again.' }, { status: 403 })
    }

    const sanitizedName = sanitizeHtml(name)
    const sanitizedEmail = sanitizeHtml(email)
    const sanitizedSubject = sanitizeHtml(subject || "New Support Request")
    const sanitizedMessage = sanitizeHtml(message)

    const { createServiceRoleClient } = await import("@/lib/supabase/service-role")
    const supabase = createServiceRoleClient() as any

    // Always open a new ticket: CAPTCHA does not prove email ownership, so a
    // public form must never append to (or reveal) another customer's thread.
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
