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

    const body = await request.json()
    const email = body.email
    const giftcardCode = body.giftcardCode

    const userName = sanitizeHtml(body.userName || "")
    const productName = sanitizeHtml(body.productName || "")
    const denomination = sanitizeHtml(body.denomination || "")
    const subject = sanitizeHtml(body.subject || "")
    const transactionId = body.transactionId || ""
    const isCompletionEmail = body.isCompletionEmail || false

    if (!email || !giftcardCode) {
      return NextResponse.json({ error: 'Email and Giftcard Code are required' }, { status: 400 })
    }

    if (user.email !== email) {
       const { data: adminUser } = await supabase.from('admin_users').select('id').eq('id', user.id).single()
       if (!adminUser) {
          return NextResponse.json({ error: "Forbidden: You cannot send emails to other users." }, { status: 403 })
       }
    }

    const emailSubject = subject || `Your ${productName} Giftcard Code from Byiora`

    // Combined completion + giftcode email template (when admin sends giftcard code)
    const htmlContent = isCompletionEmail ? `
<div style="background-color: #6B3FA0; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
        To redeem this code, please follow the activation instructions on the ${productName} platform.
      </p>

      <div style="margin-top: 35px; text-align: center;">
         <a href="https://www.byiora.store/transactions" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(107, 63, 160, 0.25);">View Order Details</a>
      </div>
    </div>

    <div style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 24px; text-align: center;">
      <p style="color: #4A2A70; font-size: 13px; margin: 0 0 10px 0;">Need help activating? <a href="mailto:support@byiora.store" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #A58BC5; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>

  </div>
</div>
    ` : `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
      <p style="color: #9ca3af; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Your digital order is ready</p>
    </div>

    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 20px; margin-top: 0;">Hi ${userName ? userName : 'Valued Customer'},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Thank you for your purchase! Your order for <strong>${productName} ${denomination}</strong> has been successfully processed. Here is your digital code, ready to be redeemed immediately.</p>

      <div style="margin: 40px 0; background: linear-gradient(135deg, #4DA8DA 0%, #6B3FA0 100%); border-radius: 16px; padding: 3px; box-shadow: 0 10px 15px -3px rgba(107, 63, 160, 0.25);">
        <div style="background-color: #ffffff; border-radius: 14px; padding: 30px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Your Gift Card PIN</p>
          <div style="margin-top: 15px; font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: bold; color: #1E1E1E; letter-spacing: 4px; padding: 15px; background-color: #F5F5F5; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${giftcardCode}
          </div>
        </div>
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
        To redeem this code, Read the description of ${productName}.
      </p>

      <div style="margin-top: 35px; text-align: center;">
         <a href="https://www.byiora.store" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Return to Store</a>
      </div>
    </div>

    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help with your code? <a href="mailto:support@byiora.store" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>

  </div>
</div>
    `

    const data = await resend.emails.send({
      from: 'Byiora <order@byiora.store>',
      replyTo: 'support@byiora.store',
      to: [email],
      subject: emailSubject,
      html: htmlContent,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending email via Resend:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
