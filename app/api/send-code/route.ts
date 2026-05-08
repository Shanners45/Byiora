import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from "@/lib/supabase/server"
import { sanitizeHtml } from '@/lib/sanitize'
import { getAdminSessionAction } from "@/app/actions/admin-utils"
import { rateLimit } from "@/lib/rate-limit"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const rl = await rateLimit(`send-code:${ip}:${user.id}`, { windowMs: 60_000, max: 20 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      )
    }

    const body = await request.json()
    const email = body.email
    const giftcardCode = body.giftcardCode

    const userName = sanitizeHtml(body.userName || "")
    const productName = sanitizeHtml(body.productName || "")
    const denomination = sanitizeHtml(body.denomination || "")
    const subject = sanitizeHtml(body.subject || "")
    const transactionId = body.transactionId || ""


    if (!email || !giftcardCode) {
      return NextResponse.json({ error: 'Email and Giftcard Code are required' }, { status: 400 })
    }

    if (user.email !== email) {
      const session = await getAdminSessionAction()
      if (!session.success) {
        return NextResponse.json({ error: "Forbidden: You cannot send emails to other users." }, { status: 403 })
      }
    }

    const emailStr = String(email).trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailStr)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const emailSubject = subject || `Your ${productName} from Byiora`

    // Giftcode email template
    const htmlContent = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">

    <div style="background-color: #5A3588; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
    </div>

    <div style="text-align: center; padding: 30px 40px 20px;">
      <div style="display: inline-block; background-color: #F4F0F9; border-radius: 50%; padding: 20px; margin-bottom: 15px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6B3FA0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <h2 style="color: #4A2A70; font-size: 24px; margin: 0;">Order Successful!</h2>
    </div>

    <div style="padding: 0 40px 40px;">
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 30px;">
        Hi ${userName ? userName : 'there'}, your purchase is complete. Your digital code for <strong>${productName} ${denomination}</strong> is ready to be activated.
      </p>

      <div style="background: linear-gradient(135deg, rgba(107, 63, 160, 0.05) 0%, rgba(77, 168, 218, 0.05) 100%); border: 2px dashed #6B3FA0; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; color: #6B3FA0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Your Activation PIN</p>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 700; color: #1f2937; letter-spacing: 4px; word-break: break-all;">
          ${giftcardCode}
        </div>
      </div>

      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
        For steps on how to activate your ${productName} , please check the description section on the Byiora product page.
      </p>

      <div style="margin-top: 35px; text-align: center;">
         <a href="https://www.byiora.store" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(107, 63, 160, 0.25);">Return to Store</a>
      </div>
    </div>

    <div style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 24px; text-align: center;">
      <p style="color: #4A2A70; font-size: 13px; margin: 0 0 10px 0;">Need help activating? <a href= "https://www.byiora.store/contact" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #A58BC5; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>

  </div>
</div>
    `

    const data = await resend.emails.send({
      from: 'Byiora <order-status@byiora.store>',
      replyTo: 'support@byiora.store',
      to: [emailStr],
      subject: emailSubject,
      html: htmlContent,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending email via Resend:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
