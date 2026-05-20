import { Resend } from "resend"
import { sanitizeHtml } from "@/lib/sanitize"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY is not configured")
  return new Resend(key)
}

export async function sendWelcomeEmail(input: { email: string; userName?: string }) {
  const resend = getResend()
  const email = input.email.trim().toLowerCase()
  const userName = sanitizeHtml(input.userName || "Valued Customer")

  const htmlContent = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Welcome to the Family</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 24px; margin-top: 0; text-align: center;">Welcome to Byiora, ${userName}!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-top: 20px;">
        We're thrilled to have you on board. Byiora is your premium destination for instant digital gift cards and game vouchers.
      </p>
      <div style="text-align: center; margin-top: 35px;">
        <a href="https://www.byiora.store" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Start Shopping Now</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Have any questions? <a href="https://www.byiora.store/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">We're here to help!</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
  `

  return await resend.emails.send({
    from: "Byiora <noreply@byiora.store>",
    to: [email],
    subject: "Welcome to Byiora!",
    html: htmlContent,
  })
}

export async function sendOrderPlacedEmail(input: {
  email: string
  userName?: string
  productName: string
  denomination?: string
  transactionId?: string
  price?: string
  paymentMethod?: string
  orderDateIso?: string
}) {
  const resend = getResend()

  const email = input.email.trim().toLowerCase()
  const transactionId = sanitizeHtml(input.transactionId || "")
  const userName = sanitizeHtml(input.userName || "")
  const productName = sanitizeHtml(input.productName || "")
  const denomination = sanitizeHtml(input.denomination || "")
  const price = sanitizeHtml(input.price || "")
  const paymentMethod = sanitizeHtml(input.paymentMethod || "")

  const orderDate = input.orderDateIso
    ? new Date(input.orderDateIso).toLocaleString("en-US", {
      timeZone: "Asia/Kathmandu",
      dateStyle: "medium",
      timeStyle: "short",
    })
    : new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kathmandu",
      dateStyle: "medium",
      timeStyle: "short",
    })

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding: 10px 16px; font-size: 14px; color: #6b7280; font-weight: 600; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; width: 35%; vertical-align: top;">${label}</td>
      <td style="padding: 10px 16px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #e5e7eb; word-break: break-word;">${value}</td>
    </tr>`

  const htmlContent = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Order Placed Successfully</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 20px; margin-top: 0;">Hi ${userName ? userName : "valued customer"},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Thank you for your order! We've successfully received your request for <strong>${productName}</strong>. Your order is currently being verified and processed.</p>
      <div style="margin: 32px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background-color: #6B3FA0; padding: 12px 16px;">
          <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Order Summary</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Product", `${productName}`)}
          ${row("Amount", denomination || "—")}
          ${row("Price", price ? `NPR ${price}` : "—")}
          ${row("Payment Method", paymentMethod || "—")}
          ${row("Transaction ID", transactionId || "—")}
          ${row("Order Date", orderDate)}
        </table>
      </div>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
        We will notify you again via email as soon as your order has been completed!
      </p>
      <div style="margin-top: 35px; text-align: center;">
         <a href="https://www.byiora.store/transactions" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Order Status</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help with your order? <a href="https://www.byiora.store/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
  `

  return await resend.emails.send({
    from: "Byiora <order-status@byiora.store>",
    replyTo: "support@byiora.store",
    to: [email],
    subject: `Order Placed: ${productName}`,
    html: htmlContent,
  })
}

export async function sendPasswordChangedEmail(input: { email: string }) {
  const resend = getResend()
  const email = input.email.trim().toLowerCase()
  const changeDate = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
    timeStyle: "short",
  })

  const htmlContent = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.store/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Security Alert</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 22px; margin-top: 0; text-align: center;">Password Changed Successfully</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-top: 20px;">
        Your Byiora account password was updated on <strong>${changeDate}</strong>.
      </p>
      <div style="margin: 30px 0; padding: 20px; background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px;">
        <p style="color: #991B1B; font-size: 14px; margin: 0; line-height: 1.6; text-align: center;">
          <strong>Didn't make this change?</strong><br/>
          Please contact our support team immediately to secure your account.
        </p>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://www.byiora.store/contact" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Contact Support</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
  `

  return await resend.emails.send({
    from: "Byiora <noreply@byiora.store>",
    to: [email],
    subject: "Your Byiora Password Has Been Changed",
    html: htmlContent,
  })
}

