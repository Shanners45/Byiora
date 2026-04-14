import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from "@/lib/supabase/server"

const resend = new Resend(process.env.RESEND_API_KEY)

// Simple HTML sanitization function to replace DOMPurify
function sanitizeHtml(input: string): string {
  if (!input) return ""
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const body = await request.json()
    const email = body.email
    const transactionId = body.transactionId

    const userName = sanitizeHtml(body.userName || "")
    const productName = sanitizeHtml(body.productName || "")
    const denomination = sanitizeHtml(body.denomination || "")

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }



    const emailSubject = `Order Placed: ${productName} ${denomination}`

    const htmlContent = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
      <p style="color: #9ca3af; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Order Placed Successfully</p>
    </div>

    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 20px; margin-top: 0;">Hi ${userName ? userName : 'Valued Customer'},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Thank you for your order! We've successfully received your request for <strong>${productName} ${denomination}</strong>. Your order is currently being verified and processed.</p>

      <div style="margin: 40px 0; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); border-radius: 16px; padding: 3px; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.25);">
        <div style="background-color: #ffffff; border-radius: 14px; padding: 30px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Order Status</p>
          <div style="margin-top: 15px; font-family: 'Arial', sans-serif; font-size: 24px; font-weight: bold; color: #F59E0B; letter-spacing: 2px; padding: 15px; background-color: #FFFBEB; border-radius: 8px; border: 1px solid #FEF3C7; text-transform: uppercase;">
            PENDING
          </div>
          <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 12px;">Transaction ID: ${transactionId || 'N/A'}</p>
        </div>
      </div>

      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
        We will notify you again via email as soon as your order has been completed!
      </p>

      <div style="margin-top: 35px; text-align: center;">
         <a href="https://www.byiora.store/transactions" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Order Status</a>
      </div>
    </div>

    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help with your order? <a href="mailto:support@byiora.store" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
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
    console.error('Error sending order placed email:', error)
    return NextResponse.json({ error: 'Failed to send placed email' }, { status: 500 })
  }
}
