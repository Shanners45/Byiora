import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from "@/lib/supabase/server"
import { sanitizeHtml } from '@/lib/sanitize'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admins only
    const { data: adminUser } = await supabase.from('admin_users').select('id, role').eq('id', user.id).single()
    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 })
    }

    const body = await request.json()
    const email = body.email
    const status = body.status
    const transactionId = body.transactionId

    const userName = sanitizeHtml(body.userName || "")
    const productName = sanitizeHtml(body.productName || "")
    const denomination = sanitizeHtml(body.denomination || "")
    const remarks = sanitizeHtml(body.remarks || "")

    if (!email || !status) {
      return NextResponse.json({ error: 'Email and Status are required' }, { status: 400 })
    }

    const isCompleted = status === 'Completed'
    const statusText = isCompleted ? 'Completed' : 'Failed'

    const emailSubject = `Your order has been: ${statusText}`

    // Derive display name — for the greeting line
    const displayName = userName || email.split('@')[0]

    // Completed Order Email Template - Table-based, mobile-optimized
    const completedTemplate = `
<div style="background-color: #f3f4f6; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">

    <tr>
      <td style="background-color: #5A3588; padding: 30px 20px; text-align: center;">
        <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 40px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
        <p style="color: #EBE3F5; margin: 12px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Order Delivered Successfully</p>
      </td>
    </tr>

    <tr>
      <td style="padding: 30px 20px;">

        <h2 style="color: #1E1E1E; font-size: 20px; font-weight: 700; margin: 0 0 6px 0;">Hi ${displayName},</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
          Great news! Your order for <strong>${productName} ${denomination}</strong> has been successfully processed and delivered.
        </p>

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F4F0F9; border: 2px solid #D8CBEB; border-radius: 12px; margin-bottom: 25px;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Order Status</p>
              <div style="font-size: 20px; font-weight: bold; color: #6B3FA0; letter-spacing: 2px; padding: 10px; background-color: #ffffff; border-radius: 8px; text-transform: uppercase;">
                ${statusText}
              </div>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">Transaction ID: ${transactionId || 'N/A'}</p>
            </td>
          </tr>
        </table>

        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
          We hope you enjoy your purchase!
        </p>

      </td>
    </tr>

    <tr>
      <td style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 20px; text-align: center;">
        <p style="color: #4A2A70; font-size: 13px; margin: 0 0 8px 0;">Need help? <a href="https://www.byiora.store/contact" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
        <p style="color: #A58BC5; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
      </td>
    </tr>

  </table>
</div>
    `

    // Failed Order Email Template - Table-based, mobile-optimized
    const failedTemplate = `
<div style="background-color: #f3f4f6; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">

    <tr>
      <td style="background-color: #5A3588; padding: 30px 20px; text-align: center;">
        <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 40px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
        <p style="color: #EBE3F5; margin: 12px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Order Processing Issue</p>
      </td>
    </tr>

    <tr>
      <td style="padding: 30px 20px;">

        <h2 style="color: #1E1E1E; font-size: 20px; font-weight: 700; margin: 0 0 6px 0;">Hi ${displayName},</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
          We regret to inform you that there was an issue processing your order. Please review the details below.
        </p>

        <div style="margin-bottom: 20px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; color: #6b7280; font-weight: 600; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; white-space: nowrap;">Item</td>
              <td style="padding: 10px 16px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${productName} ${denomination}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; color: #6b7280; font-weight: 600; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; white-space: nowrap;">Transaction ID</td>
              <td style="padding: 10px 16px; font-size: 13px; color: #1f2937; border-bottom: 1px solid #e5e7eb; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; word-break: break-all;">${transactionId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; color: #6b7280; font-weight: 600; background-color: #f9fafb;${remarks ? ' border-bottom: 1px solid #e5e7eb;' : ''} white-space: nowrap;">Order Status</td>
              <td style="padding: 10px 16px; font-size: 14px; color: #dc2626; font-weight: 600; text-transform: uppercase;${remarks ? ' border-bottom: 1px solid #e5e7eb;' : ''}">${statusText}</td>
            </tr>
            ${remarks ? `
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; color: #6b7280; font-weight: 600; background-color: #f9fafb; white-space: nowrap;">Reason</td>
              <td style="padding: 10px 16px; font-size: 14px; color: #dc2626; font-weight: 600;">${remarks}</td>
            </tr>` : ''}
          </table>
        </div>

      </td>
    </tr>

    <tr>
      <td style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 20px; text-align: center;">
        <p style="color: #4A2A70; font-size: 13px; margin: 0 0 8px 0;">Need help? <a href="https://www.byiora.store/contact" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
        <p style="color: #A58BC5; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
      </td>
    </tr>

  </table>
</div>
    `

    const htmlContent = isCompleted ? completedTemplate : failedTemplate

    const data = await resend.emails.send({
      from: 'Byiora <order-status@byiora.store>',
      replyTo: 'support@byiora.store',
      to: [email],
      subject: emailSubject,
      html: htmlContent,
    })

    // Resend Automation: fire event for failed orders to trigger follow-up email
    // (Contact was already added to Audience at order placement)
    if (!isCompleted) {
      try {
        await resend.events.send({
          event: 'failed_order_email_received',
          email: email,
        })
      } catch (eventError) {
        console.error('Resend automation trigger failed (non-blocking):', eventError)
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending order status email:', error)
    return NextResponse.json({ error: 'Failed to send status email' }, { status: 500 })
  }
}
