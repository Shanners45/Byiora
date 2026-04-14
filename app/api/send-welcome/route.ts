import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sanitizeHtml } from '@/lib/sanitize'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = body.email
    const userName = sanitizeHtml(body.userName || "Valued Merchant")

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const htmlContent = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
      <p style="color: #9ca3af; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Welcome to the Family</p>
    </div>

    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 24px; margin-top: 0; text-align: center;">Welcome to Byiora, ${userName}!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-top: 20px;">
        We're thrilled to have you on board. Byiora is your premium destination for instant digital gift cards and game vouchers.
      </p>

      <div style="margin: 40px 0; background-color: #F9FAFB; border-radius: 12px; padding: 30px; border: 1px dashed #D1D5DB;">
        <h3 style="color: #6B3FA0; font-size: 18px; margin-top: 0;">Why choose Byiora?</h3>
        <ul style="color: #4b5563; font-size: 14px; padding-left: 20px; margin-bottom: 0;">
          <li style="margin-bottom: 10px;"><strong>Instant Delivery:</strong> Get your codes immediately after payment.</li>
          <li style="margin-bottom: 10px;"><strong>Secure Payments:</strong> Multiple trusted payment methods available.</li>
          <li style="margin-bottom: 10px;"><strong>Wide Selection:</strong> From Steam to PUBG, we've got you covered.</li>
          <li><strong>24/7 Support:</strong> Our team is always here to help you.</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 35px;">
        <a href="https://www.byiora.store" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 10px rgba(107, 63, 160, 0.3);">Start Shopping Now</a>
      </div>
    </div>

    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Have any questions? <a href="mailto:support@byiora.store" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">We're here to help!</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>

  </div>
</div>
    `

    const data = await resend.emails.send({
      from: 'Byiora <welcome@byiora.store>',
      to: [email],
      subject: 'Welcome to Byiora! 🎮',
      html: htmlContent,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 })
  }
}
