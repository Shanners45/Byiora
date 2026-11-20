"use server"

import { Resend } from "resend"
import { verifySuperAdmin } from "@/app/actions/admin-utils"
import { sanitizeHtml } from "@/lib/sanitize"
import { rateLimit } from "@/lib/rate-limit"
import { RESEND_SEGMENTS, RESEND_TOPICS } from "@/lib/email/resend"

type Audience = keyof typeof RESEND_SEGMENTS
type Topic = keyof typeof RESEND_TOPICS

const escapeText = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function renderBroadcast(subject: string, bodyHtml: string) {
  // {{{RESEND_UNSUBSCRIBE_URL}}} is filled in per recipient by Resend.
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;padding-bottom:16px">${escapeText(subject)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">
You are receiving this because you shopped at Byiora.
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#6b7280">Manage email preferences</a>
</td></tr></table></td></tr></table></body></html>`
}

const UNSUBSCRIBE = "{{{RESEND_UNSUBSCRIBE_URL}}}"

/**
 * A pasted full email template is sent as-is (sanitizeHtml would strip its
 * tables and inline styles), minus active content, and always carries an
 * unsubscribe link (required for topic broadcasts).
 */
function prepareTemplate(source: string): string {
  let out = source
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(iframe|object|embed|form)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(iframe|object|embed|form|script)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
  if (!out.includes(UNSUBSCRIBE)) {
    const footer = '<p style="text-align:center;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;margin:24px 0">' +
      '<a href="' + UNSUBSCRIBE + '" style="color:#6b7280">Manage email preferences</a></p>'
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, footer + "</body>") : out + footer
  }
  return out
}

export async function getBroadcastOptionsAction() {
  if (!(await verifySuperAdmin())) return { error: "Unauthorized: Super admin access required" }
  return {
    success: true,
    audiences: [
      { key: "allCustomers", name: "All customers" },
      { key: "registered", name: "Registered users only" },
    ],
    topics: Object.entries(RESEND_TOPICS).map(([key, t]) => ({ key, name: t.name })),
  }
}

export async function sendBroadcastAction(input: {
  subject: string
  previewText?: string
  html: string
  isTemplate?: boolean
  audience: Audience
  topic: Topic
  scheduledAt?: string | null
}) {
  if (!(await verifySuperAdmin())) return { error: "Unauthorized: Super admin access required" }

  // A broadcast reaches every customer: cap it even for a valid admin session.
  const rl = await rateLimit("broadcast-send:global", { windowMs: 3_600_000, max: 5 })
  if (!rl.ok) return { error: "Broadcast limit reached (5 per hour). Please wait before sending another." }

  const subject = String(input.subject || "").trim()
  const previewText = String(input.previewText || "").trim()
  const rawHtml = String(input.html || "")
  if (rawHtml.length > 500_000) return { error: "Email is too large (max 500 KB)." }
  const bodyHtml = input.isTemplate ? prepareTemplate(rawHtml) : sanitizeHtml(rawHtml)
  const segmentId = RESEND_SEGMENTS[input.audience]
  const topic = RESEND_TOPICS[input.topic]

  if (subject.length < 3 || subject.length > 150) return { error: "Subject must be 3–150 characters." }
  if (previewText.length > 150) return { error: "Preview text must be at most 150 characters." }
  if (bodyHtml.replace(/<[^>]*>/g, "").trim().length < 5) return { error: "Message is empty." }
  if (!segmentId) return { error: "Choose who should receive this broadcast." }
  if (!topic) return { error: "Choose a topic so recipients can unsubscribe from it." }

  let scheduledAt: string | undefined
  if (input.scheduledAt) {
    const when = new Date(input.scheduledAt)
    if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) return { error: "Schedule time must be in the future." }
    scheduledAt = when.toISOString()
  }

  const key = process.env.RESEND_API_KEY
  if (!key) return { error: "RESEND_API_KEY is not configured" }

  const { data, error } = await new Resend(key).broadcasts.create({
    name: `${subject} (${new Date().toISOString().slice(0, 10)})`,
    from: "Byiora <updates@byiora.com.np>",
    replyTo: "support@byiora.com.np",
    subject,
    previewText: previewText || undefined,
    html: input.isTemplate ? bodyHtml : renderBroadcast(subject, bodyHtml),
    segmentId,
    topicId: topic.id,
    send: true,
    ...(scheduledAt ? { scheduledAt } : {}),
  } as any)

  if (error) return { error: error.message || "Resend rejected the broadcast." }
  return { success: true, id: data?.id, scheduled: Boolean(scheduledAt) }
}
