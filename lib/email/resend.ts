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
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Welcome to the Family</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 24px; margin-top: 0; text-align: center;">Welcome to Byiora, ${userName}!</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-top: 20px;">
        We're thrilled to have you on board. Byiora is your premium destination for instant digital gift cards and game vouchers.
      </p>
      <div style="text-align: center; margin-top: 35px;">
        <a href="https://www.byiora.com.np" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Start Shopping Now</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Have any questions? <a href="https://www.byiora.com.np/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">We're here to help!</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
  `

  return await resend.emails.send({
    from: "Byiora <noreply@byiora.com.np>",
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
  isGuest?: boolean
  status?: string
  customMessage?: string
  subjectOverride?: string
  actionButton?: {
    label: string
    url: string
    subtext?: string
  }
}) {
  const resend = getResend()

  const email = input.email.trim().toLowerCase()
  const transactionId = sanitizeHtml(input.transactionId || "")
  const userName = sanitizeHtml(input.userName || "")
  const productName = sanitizeHtml(input.productName || "")
  const denomination = sanitizeHtml(input.denomination || "")
  const price = sanitizeHtml(input.price || "")
  const paymentMethod = sanitizeHtml(input.paymentMethod || "")
  const statusLabel = input.status || "Order Placed Successfully"
  const customMsg = input.customMessage || "Thank you for your order! We've successfully received your request for <strong>" + productName + "</strong>. Your order is currently being verified and processed."

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
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">${statusLabel}</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 20px; margin-top: 0;">Hi ${userName ? userName : "valued customer"},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">${customMsg}</p>
      <div style="margin: 32px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background-color: #6B3FA0; padding: 12px 16px;">
          <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Order Summary</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Product", `${productName}`)}
          ${row("Amount", denomination || "—")}
          ${row("Price", price ? `NPR ${price}` : "—")}
          ${row("Payment Method", paymentMethod || "—")}
          ${row("Order ID", transactionId || "—")}
          ${row("Order Date", orderDate)}
        </table>
      </div>
      ${(!input.status || (!input.status.toLowerCase().includes("failed") && !input.status.toLowerCase().includes("cancelled"))) ? `
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
        We will notify you again via email as soon as your order has been completed!
      </p>` : ''}
      ${input.actionButton ? `
      <div style="margin-top: 30px; text-align: center;">
        <a href="${input.actionButton.url}" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(107, 63, 160, 0.2);">${input.actionButton.label}</a>
        ${input.actionButton.subtext ? `<p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">${input.actionButton.subtext}</p>` : ''}
      </div>
      ` : (!input.isGuest && (!input.status || (!input.status.toLowerCase().includes("failed") && !input.status.toLowerCase().includes("cancelled"))) ? `
      <div style="margin-top: 35px; text-align: center;">
         <a href="https://www.byiora.com.np/transactions" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Order Status</a>
      </div>
      ` : '')}
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help with your order? <a href="https://www.byiora.com.np/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
  `

  return await resend.emails.send({
    from: "Byiora <order-status@byiora.com.np>",
    replyTo: "support@byiora.com.np",
    to: [email],
    subject: input.subjectOverride || `Order Placed: ${productName}`,
    html: htmlContent,
  })
}

export async function sendGiftcardCodeEmail(input: {
  email: string
  userName?: string
  productName: string
  denomination?: string
  transactionId?: string
  price?: string
  paymentMethod?: string
  giftcardCode: string
  isGuest?: boolean
  subjectOverride?: string
}) {
  const resend = getResend()
  const email = input.email.trim().toLowerCase()
  const userName = sanitizeHtml(input.userName || "Valued Customer")
  const productName = sanitizeHtml(input.productName || "Gift Card")
  const denomination = sanitizeHtml(input.denomination || "")
  const transactionId = sanitizeHtml(input.transactionId || "")
  const price = sanitizeHtml(input.price || "")
  const paymentMethod = sanitizeHtml(input.paymentMethod || "")
  const giftcardCode = sanitizeHtml(input.giftcardCode || "")
  
  const htmlContent = `
<div style="background-color: #f3f4f6; padding: 30px 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">

    <div style="background-color: #5A3588; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
      <p style="color: #EBE3F5; margin: 12px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Digital Code Delivery</p>
    </div>

    <div style="text-align: center; padding: 30px 40px 10px;">
      <div style="display: inline-block; background-color: #F4F0F9; border-radius: 50%; padding: 18px; margin-bottom: 15px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6B3FA0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <h2 style="color: #4A2A70; font-size: 22px; margin: 0;">Order Completed & Delivered!</h2>
    </div>

    <div style="padding: 0 40px 35px;">
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 25px;">
        Hi <strong>${userName}</strong>, thank you for your order! Your digital code for <strong>${productName} ${denomination}</strong> is ready to be activated.
      </p>

      <div style="background: linear-gradient(135deg, rgba(107, 63, 160, 0.05) 0%, rgba(77, 168, 218, 0.05) 100%); border: 2px dashed #6B3FA0; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0;">
        <p style="margin: 0 0 10px 0; color: #6B3FA0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Your Activation Code / PIN</p>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: 700; color: #1f2937; letter-spacing: 3px; word-break: break-all;">
          ${giftcardCode}
        </div>
      </div>

      <div style="margin: 25px 0; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 16px; font-size: 13px; color: #6b7280; font-weight: 600; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; width: 35%;">Order ID</td>
            <td style="padding: 10px 16px; font-size: 13px; color: #1f2937; border-bottom: 1px solid #e5e7eb; font-family: ui-monospace, monospace;">${transactionId || '—'}</td>
          </tr>
          ${price ? `
          <tr>
            <td style="padding: 10px 16px; font-size: 13px; color: #6b7280; font-weight: 600; background-color: #f9fafb; width: 35%;">Amount Paid</td>
            <td style="padding: 10px 16px; font-size: 13px; color: #1f2937;">NPR ${price}${paymentMethod ? ` via ${paymentMethod}` : ''}</td>
          </tr>` : ''}
        </table>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 25px 0;">
        For instructions on how to activate your ${productName}, please check the description section on the Byiora product page.
      </p>

      <div style="text-align: center;">
         <a href="https://www.byiora.com.np" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Return to Store</a>
      </div>
    </div>

    <div style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 20px; text-align: center;">
      <p style="color: #4A2A70; font-size: 13px; margin: 0 0 8px 0;">Need help activating? <a href="https://www.byiora.com.np/contact" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #A58BC5; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>

  </div>
</div>`

  return await resend.emails.send({
    from: "Byiora <order-status@byiora.com.np>",
    replyTo: "support@byiora.com.np",
    to: [email],
    subject: input.subjectOverride || `Your ${productName} Giftcard Code from Byiora`,
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
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" />
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
        <a href="https://www.byiora.com.np/contact" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Contact Support</a>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
  `

  return await resend.emails.send({
    from: "Byiora <noreply@byiora.com.np>",
    to: [email],
    subject: "Your Byiora Password Has Been Changed",
    html: htmlContent,
  })
}

