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
<div style="background-color: #6B3FA0; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">

    <tr>
      <td style="background-color: #5A3588; padding: 30px 20px; text-align: center;">
        <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 40px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
        <p style="color: #EBE3F5; margin: 12px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Order Delivered Successfully</p>
      </td>
    </tr>

    <tr>
      <td style="padding: 30px 20px;">

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
          <tr>
            <td align="center">
              <div style="display: inline-block; background-color: #F4F0F9; border-radius: 50%; width: 72px; height: 72px; line-height: 72px; text-align: center;">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6B3FA0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
            </td>
          </tr>
        </table>

        <h2 style="color: #4A2A70; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">Order Completed! 🎉</h2>

        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
          Hi ${displayName},
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0; text-align: center;">
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
          We hope you enjoy your purchase! Check your email for your gift card code/details or visit your transaction history.
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
<div style="background-color: #6B3FA0; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">

    <tr>
      <td style="background-color: #5A3588; padding: 30px 20px; text-align: center;">
        <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 40px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
        <p style="color: #EBE3F5; margin: 12px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Order Processing Issue</p>
      </td>
    </tr>

    <tr>
      <td style="padding: 30px 20px;">

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
          <tr>
            <td align="center">
              <div style="background-color: #fee2e2; width: 48px; height: 48px; border-radius: 12px; margin: 0 auto; text-align: center; line-height: 48px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
            </td>
          </tr>
        </table>

        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.5px; text-align: center;">Order Failed</h2>

        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
          Hi ${displayName},
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0; text-align: center;">
          We regret to inform you that there was an issue processing your order. Please review the details below.
        </p>

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 20px;">

          <tr>
            <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Item</p>
              <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 600;">${productName} ${denomination}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Transaction ID</p>
              <p style="margin: 0; color: #4b5563; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; word-break: break-all;">${transactionId || 'N/A'}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 14px 16px;${remarks ? ' border-bottom: 1px solid #e5e7eb;' : ''}">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Order Status</p>
              <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 600; text-transform: uppercase;">${statusText}</p>
            </td>
          </tr>

          ${remarks ? `
          <tr>
            <td style="padding: 14px 16px;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Reason</p>
              <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 600;">${remarks}</p>
            </td>
          </tr>` : ''}

        </table>

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

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending order status email:', error)
    return NextResponse.json({ error: 'Failed to send status email' }, { status: 500 })
  }
}
