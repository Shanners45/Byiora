"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getAdminSessionAction } from "./admin-utils"
import { Resend } from "resend"
import { sanitizeHtml } from "@/lib/sanitize"

const resend = new Resend(process.env.RESEND_API_KEY)

export interface TicketReply {
  reply: string
  reply_by: string
  replied_at: string
  sender?: "admin" | "customer"
}

export interface SupportTicket {
  id: string
  ticket_number: string
  name: string
  email: string
  subject: string
  message: string
  status: "open" | "replied" | "resolved" | "closed"
  created_at: string
  replied_at?: string | null
  last_reply?: string | null
  last_reply_by?: string | null
  replies?: TicketReply[] | null
}

/**
 * Fetches all customer support tickets for the admin dashboard directly from Supabase.
 */
export async function getSupportTicketsAction(): Promise<{
  success: boolean
  data?: SupportTicket[]
  error?: string
}> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  try {
    const supabase = createServiceRoleClient() as any
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: (data as SupportTicket[]) || [] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Replies to a support ticket directly from the admin dashboard via Resend.
 */
export async function replyToSupportTicketAction({
  ticketId,
  replyMessage,
}: {
  ticketId: string
  replyMessage: string
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  if (!replyMessage || replyMessage.trim().length === 0) {
    return { success: false, error: "Reply message cannot be empty" }
  }

  try {
    const supabase = createServiceRoleClient() as any

    // 1. Fetch ticket details from Supabase
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single()

    if (ticketError || !ticket) {
      return { success: false, error: "Support ticket not found" }
    }

    const cleanReply = sanitizeHtml(replyMessage.trim())
    const adminName = session.data.name || session.data.email.split("@")[0] || "Byiora Support"

    // 2. Send branded email reply to the customer via Resend (Matching official Byiora template)
    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1F2937; margin: 0; padding: 0; background-color: #F3F4F6; }
    .container { max-width: 580px; margin: 25px auto; background: #ffffff; border-radius: 10px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #7E3AF2; padding: 22px 20px; text-align: center; }
    .header img { height: 36px; display: block; margin: 0 auto; }
    .content { padding: 32px 28px; }
    .message-body { font-size: 15px; color: #374151; line-height: 1.7; margin: 20px 0; white-space: pre-wrap; }
    .sign-off { margin-top: 28px; font-size: 14px; color: #4B5563; }
    .footer { padding: 18px 20px; text-align: center; font-size: 12px; color: #6B7280; background-color: #FAFAFA; border-top: 1px solid #E5E7EB; line-height: 1.5; }
    .footer a { color: #7E3AF2; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://www.byiora.com.np/logo-final.png" alt="Byiora Logo" />
    </div>
    <div class="content">
      <p style="font-size: 16px; margin-top: 0; color: #111827; font-weight: 600;">Hi ${ticket.name || "there"},</p>
      
      <div class="message-body">${cleanReply}</div>

      <div class="sign-off">
        <p style="margin-bottom: 2px;">Best regards,</p>
        <p style="margin-top: 0; font-weight: 700; color: #111827;">Byiora Support</p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Byiora | Premium Game Top-Up Nepal</p>
      <p style="margin: 0 0 6px 0;">
        <a href="mailto:support@byiora.com.np">support@byiora.com.np</a> &nbsp;|&nbsp; 
        <a href="https://www.byiora.com.np" target="_blank">www.byiora.com.np</a>
      </p>
      <p style="margin: 0; font-size: 11px; color: #9CA3AF;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `

    const sendResult = await resend.emails.send({
      from: "Byiora Support <support@byiora.com.np>",
      replyTo: "support@byiora.com.np",
      to: [ticket.email],
      subject: `[${ticket.ticket_number}] Re: ${ticket.subject}`,
      html: htmlEmail,
    })

    if (sendResult.error) {
      console.error("Resend ticket reply error:", sendResult.error)
      return { success: false, error: sendResult.error.message || "Failed to deliver email to customer" }
    }

    // 3. Update ticket status and append reply history in Supabase
    const nowIso = new Date().toISOString()
    const currentReplies: TicketReply[] = Array.isArray(ticket.replies)
      ? ticket.replies
      : ticket.last_reply
      ? [{ reply: ticket.last_reply, reply_by: ticket.last_reply_by || adminName, replied_at: ticket.replied_at || nowIso }]
      : []

    const newReplyItem: TicketReply = {
      reply: cleanReply,
      reply_by: adminName,
      replied_at: nowIso,
      sender: "admin",
    }

    const { error: updateError } = await supabase
      .from("support_tickets")
      .update({
        status: "replied",
        replied_at: nowIso,
        last_reply: cleanReply,
        last_reply_by: adminName,
        replies: [...currentReplies, newReplyItem],
      })
      .eq("id", ticketId)

    if (updateError) {
      console.error("Failed to update ticket status in Supabase:", updateError.message)
    }

    return { success: true }
  } catch (err: any) {
    console.error("replyToSupportTicketAction error:", err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Updates status of a support ticket directly in Supabase.
 */
export async function updateTicketStatusAction(
  ticketId: string,
  status: "open" | "replied" | "resolved" | "closed"
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  try {
    const supabase = createServiceRoleClient() as any
    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", ticketId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
