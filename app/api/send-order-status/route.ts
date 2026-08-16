import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sanitizeHtml } from '@/lib/sanitize'
import { getAdminSessionAction } from "@/app/actions/admin-utils"
import { rateLimit } from "@/lib/rate-limit"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    // Allow admin sessions OR internal server-to-server calls (cron/webhook)
    const internalSecret = request.headers.get("x-internal-secret")
    const expectedSecret = process.env.INTERNAL_API_SECRET
    const isInternalCall = internalSecret && expectedSecret && internalSecret === expectedSecret

    if (!isInternalCall) {
      const session = await getAdminSessionAction()
      if (!session.success) {
        return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 })
      }
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const rl = await rateLimit(`send-order-status:${ip}`, { windowMs: 60_000, max: 30 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      )
    }

    const body = await request.json()
    const email = body.email
    const status = body.status
    const transactionId = body.transactionId

    const userName = sanitizeHtml(body.userName || "")
    const productName = sanitizeHtml(body.productName || "")
    const denomination = sanitizeHtml(body.denomination || "")
    const remarks = sanitizeHtml(body.remarks || "")
    const isGuest = Boolean(body.isGuest)
    const isDynamic = Boolean(body.isDynamic)
    let magicLinkToken = body.magicLinkToken ? sanitizeHtml(body.magicLinkToken) : undefined

    if (isGuest && isDynamic && transactionId && !magicLinkToken) {
      try {
        const { generateGuestVerificationToken } = await import("@/app/actions/checkout-encryption")
        const rawToken = await generateGuestVerificationToken(transactionId)
        magicLinkToken = encodeURIComponent(rawToken)
      } catch (err) {
        console.error("Failed to generate magic link for order status email", err)
      }
    }

    if (!email || !status) {
      return NextResponse.json({ error: 'Email and Status are required' }, { status: 400 })
    }

    const emailStr = String(email).trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailStr)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const isCompleted = status === 'Completed'
    const isRefunded = status === 'Refunded'
    const statusText = isCompleted ? 'Completed' : (isRefunded ? 'Refunded' : 'Failed')

    const emailSubject = isCompleted
      ? `Order Delivered: ${productName || 'Your Item'}`
      : (isRefunded
        ? `Order Refunded: ${productName || 'Your Item'}`
        : `Order Failed: ${productName || 'Your Item'}`)

    // Derive display name — for the greeting line
    const displayName = userName || email.split('@')[0]

    const row = (label: string, value: string) => `
      <tr>
        <td style="padding: 10px 16px; font-size: 14px; color: #6b7280; font-weight: 600; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; width: 35%; vertical-align: top;">${label}</td>
        <td style="padding: 10px 16px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #e5e7eb; word-break: break-word;">${value}</td>
      </tr>`

    // Completed Order Email Template
    const completedTemplate = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Order Delivered Successfully</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 20px; margin-top: 0;">Hi ${displayName},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
        Great news! Your order for <strong>${productName} ${denomination}</strong> has been successfully processed and delivered.
      </p>

      <div style="margin: 32px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background-color: #6B3FA0; padding: 12px 16px;">
          <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Order Summary</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Product", `${productName} ${denomination}`.trim())}
          ${row("Order ID", transactionId || "—")}
          ${row("Status", '<span style="color: #16a34a; font-weight: 700; text-transform: uppercase;">Completed</span>')}
        </table>
      </div>

      <div style="text-align: center; margin-top: 35px;">
         <a href="https://www.byiora.com.np/transactions" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Order Details</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help? <a href="https://www.byiora.com.np/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
    `

    // Refunded Order Email Template - Matching standard design
    const refundedTemplate = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Order Refund Processed</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 20px; margin-top: 0;">Hi ${displayName},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
        A refund has been processed for your order of <strong>${productName} ${denomination}</strong>.
      </p>

      <div style="margin: 32px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background-color: #6B3FA0; padding: 12px 16px;">
          <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Refund Summary</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Product", `${productName} ${denomination}`.trim())}
          ${row("Order ID", transactionId || "—")}
          ${row("Status", '<span style="color: #7E3AF2; font-weight: 700; text-transform: uppercase;">Refunded</span>')}
          ${remarks ? row("Details", remarks) : ''}
        </table>
      </div>

      <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0; text-align: center;">
        The refund amount has been returned to your original payment method. Depending on your bank or payment provider, it may take a few moments to reflect in your account.
      </p>

      <div style="text-align: center;">
         <a href="https://www.byiora.com.np" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Return to Store</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help? <a href="https://www.byiora.com.np/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
    `

    // Failed Order Email Template
    const failedTemplate = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Order Processing Issue</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 20px; margin-top: 0;">Hi ${displayName},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
        We regret to inform you that there was an issue processing your order. Please review the details below.
      </p>

      <div style="margin: 32px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background-color: #6B3FA0; padding: 12px 16px;">
          <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Order Details</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Product", `${productName} ${denomination}`.trim())}
          ${row("Order ID", transactionId || "—")}
          ${row("Order Status", '<span style="color: #dc2626; font-weight: 700; text-transform: uppercase;">Failed</span>')}
          ${remarks ? row("Reason", remarks) : ''}
        </table>
      </div>

      ${magicLinkToken ? `
      <div style="margin-top: 25px; padding: 20px; background-color: #F4F0F9; border-radius: 8px; text-align: center;">
        <p style="color: #4A2A70; font-size: 15px; margin: 0 0 15px 0;">
          If you have already paid but your order still failed, please click the secure link below to verify your payment. This link will expire in exactly 24 hours.
        </p>
        <a href="https://www.byiora.com.np/verify-guest?token=${magicLinkToken}" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Verify Payment Securely</a>
      </div>
      ` : (!isGuest && isDynamic ? `
      <div style="margin-top: 25px; padding: 20px; background-color: #F4F0F9; border-radius: 8px; text-align: center;">
        <p style="color: #4A2A70; font-size: 15px; margin: 0 0 15px 0;">
          If you have already paid but your payment has been marked as failed, please verify your payment from your Transaction History.
        </p>
        <a href="https://www.byiora.com.np/transactions" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Visit Transaction History</a>
      </div>
      ` : '')}
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help? <a href="https://www.byiora.com.np/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
    `

    const htmlContent = isCompleted ? completedTemplate : (isRefunded ? refundedTemplate : failedTemplate)

    const data = await resend.emails.send({
      from: 'Byiora <order-status@byiora.com.np>',
      replyTo: 'support@byiora.com.np',
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
