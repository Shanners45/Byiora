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

    // Completed Order Email Template - Purple styling (when admin marks as completed)
    const completedTemplate = `
<div style="background-color: #6B3FA0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">

    <div style="background: #5A3588; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
      <p style="color: #EBE3F5; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Order Delivered Successfully</p>
    </div>

    <div style="padding: 40px;">
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="display: inline-block; background-color: #F4F0F9; border-radius: 50%; padding: 20px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6B3FA0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
      </div>

      <h2 style="color: #4A2A70; font-size: 24px; margin-top: 0; text-align: center;">Order Completed! 🎉</h2>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
        Great news! Your order for <strong>${productName} ${denomination}</strong> has been successfully processed and delivered.
      </p>

      <div style="margin: 30px 0; background: linear-gradient(135deg, #8854C0 0%, #6B3FA0 100%); border-radius: 16px; padding: 3px; box-shadow: 0 10px 15px -3px rgba(107, 63, 160, 0.25);">
        <div style="background-color: #ffffff; border-radius: 14px; padding: 25px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Order Status</p>
          <div style="margin-top: 12px; font-family: 'Arial', sans-serif; font-size: 22px; font-weight: bold; color: #6B3FA0; letter-spacing: 2px; padding: 12px; background-color: #F4F0F9; border-radius: 8px; border: 2px solid #D8CBEB; text-transform: uppercase;">
            ${statusText}
          </div>
          <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 12px;">Transaction ID: ${transactionId || 'N/A'}</p>
        </div>
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
        We hope you enjoy your purchase! You can view your complete order history and gift card details in your transaction history.
      </p>

      <div style="margin-top: 30px; text-align: center;">
         <a href="https://www.byiora.store/transactions" style="display: inline-block; background: #6B3FA0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(107, 63, 160, 0.25);">View Transaction History</a>
      </div>
    </div>

    <div style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 24px; text-align: center;">
      <p style="color: #4A2A70; font-size: 13px; margin: 0 0 10px 0;">Need help with your order? <a href="mailto:support@byiora.store" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #A58BC5; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>

  </div>
</div>
    `

    // Failed Order Email Template - Clean table-based layout
    const failedTemplate = `
<div style="background-color: #6B3FA0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">

    <tr>
      <td style="background-color: #5A3588; padding: 35px 40px; text-align: center;">
        <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
        <p style="color: #EBE3F5; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Order Processing Issue</p>
      </td>
    </tr>

    <tr>
      <td style="padding: 40px;">

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
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

        <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 10px 0; letter-spacing: -0.5px; text-align: center;">Order Failed</h2>

        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 6px 0; text-align: center;">
          Hi${userName ? ` ${userName}` : ''},
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0; text-align: center;">
          We regret to inform you that there was an issue processing your order. Please review the details below.
        </p>

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 30px;">

          <tr>
            <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Item</p>
              <p style="margin: 0; color: #111827; font-size: 15px; font-weight: 600;">${productName} ${denomination}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Transaction ID</p>
              <p style="margin: 0; color: #4b5563; font-size: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${transactionId || 'N/A'}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 16px 20px;${remarks ? ' border-bottom: 1px solid #e5e7eb;' : ''}">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Order Status</p>
              <p style="margin: 0; color: #dc2626; font-size: 15px; font-weight: 600; text-transform: uppercase;">${statusText}</p>
            </td>
          </tr>

          ${remarks ? `
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Reason</p>
              <p style="margin: 0; color: #dc2626; font-size: 15px; font-weight: 600;">${remarks}</p>
            </td>
          </tr>` : ''}

        </table>

      </td>
    </tr>

    <tr>
      <td style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 24px; text-align: center;">
        <p style="color: #4A2A70; font-size: 13px; margin: 0 0 10px 0;">Need help with your order? <a href="https://www.byiora.store/contact" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
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
