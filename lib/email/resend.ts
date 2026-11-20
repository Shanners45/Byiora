import { Resend } from "resend"
import { sanitizeHtml } from "@/lib/sanitize"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY is not configured")
  return new Resend(key)
}

/**
 * Adds legitimate customer emails to Resend Audience for broadcasts & updates.
 * Anti-spam conditions:
 * 1. Valid email format validation.
 * 2. Excludes test / fake / bot accounts (e.g. test@, fake@, admin@).
 * 3. Enforces trusted reputable email providers (Gmail, Outlook, Yahoo, iCloud, Hotmail).
 * 4. Graceful and non-blocking — never breaks order processing or email sending.
 */
/** Resend segment / topic IDs (not secrets; created in the Resend dashboard). */
export const RESEND_SEGMENTS = {
  allCustomers: "96dd5f69-0ff7-410b-8e69-c65709634999",
  registered: "96e1b97d-c7bf-4293-92a2-71bac425b6c7",
} as const

export const RESEND_TOPICS = {
  offers: { id: "6305adbd-1ff0-4a91-abd1-79bdef481990", name: "Offers & Promotions" },
  updates: { id: "f08e7810-888a-4c85-8376-5fc61281bbff", name: "Store Updates" },
  review: { id: "745c75c3-e499-4a7d-a1fe-1d0d87a0b188", name: "Review" },
} as const

export async function addCustomerToAudience(email: string, firstName?: string, isRegistered: boolean = false) {
  try {
    if (!email || typeof email !== "string") return

    const cleanEmail = email.trim().toLowerCase()
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(cleanEmail)) return

    const [userPart, domain] = cleanEmail.split("@")
    if (!userPart || !domain) return

    // 1. Exclude obvious test / fake addresses
    if (
      userPart === "test" ||
      userPart === "admin" ||
      userPart === "demo" ||
      userPart === "fake" ||
      userPart === "spam" ||
      userPart.startsWith("test+") ||
      userPart.startsWith("noreply")
    ) {
      return
    }

    // 2. Trusted reputable domains (like before, focusing on Gmail and major reliable providers)
    const TRUSTED_DOMAINS = [
      "gmail.com",
      "googlemail.com",
      "yahoo.com",
      "outlook.com",
      "hotmail.com",
      "icloud.com",
    ]

    if (!TRUSTED_DOMAINS.includes(domain)) {
      return
    }

    const resend = getResend()

    // Every buyer joins "All Customers"; only registered accounts get a name and
    // the "Registered USERS" segment. Topic subscriptions use each topic's
    // opt-in default, and every broadcast carries an unsubscribe link.
    const segmentIds = [RESEND_SEGMENTS.allCustomers, ...(isRegistered ? [RESEND_SEGMENTS.registered] : [])]
    const payload: { email: string; unsubscribed: boolean; firstName?: string; segments: { id: string }[] } = {
      email: cleanEmail,
      unsubscribed: false,
      segments: segmentIds.map((id) => ({ id })),
    }
    const cleanName = firstName?.trim()
    if (isRegistered && cleanName && !["customer", "valued customer"].includes(cleanName.toLowerCase())) {
      payload.firstName = sanitizeHtml(cleanName).trim()
    }

    // The SDK returns errors instead of throwing. An existing contact (e.g. a
    // guest who later registers) still needs the new segment membership.
    const { error } = await resend.contacts.create(payload)
    if (error) {
      await Promise.all(segmentIds.map((segmentId) => resend.contacts.segments.add({ email: cleanEmail, segmentId })))
    }
  } catch (err: any) {
    console.error("[RESEND AUDIENCE] Non-blocking sync error:", err?.message || err)
  }
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

  // Non-blocking audience sync with anti-spam check (Registered user account -> isRegistered: true)
  addCustomerToAudience(email, userName, true).catch(() => {})

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

  // Non-blocking audience sync with anti-spam check (Only tag Registered USERS if not guest, no names for guests)
  addCustomerToAudience(email, !input.isGuest ? userName : undefined, !input.isGuest).catch(() => {})

  return await resend.emails.send({
    from: "Byiora <order-status@byiora.com.np>",
    replyTo: "support@byiora.com.np",
    to: [email],
    subject: input.subjectOverride || `Order Placed: ${productName}`,
    html: htmlContent,
  })
}

/**
 * A delivered "code" that is really a redemption link gets a button instead of
 * a PIN box. Only plain https URLs qualify; the result is HTML-attribute safe.
 */
export function getRedeemUrl(code: string | null | undefined): string | null {
  const value = String(code || "").trim()
  if (!/^https:\/\/\S+$/i.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    return url.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  } catch {
    return null
  }
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
  const redeemUrl = getRedeemUrl(input.giftcardCode)
  
  const htmlContent = `
<div style="background-color: #f3f4f6; padding: 30px 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">

    <div style="background-color: #5A3588; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
    </div>

    <div style="text-align: center; padding: 35px 40px 10px;">
      <h2 style="color: #4A2A70; font-size: 22px; font-weight: 700; margin: 0;">Order Successful!</h2>
    </div>

    <div style="padding: 0 40px 35px;">
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 25px;">
        Hi <strong>${userName}</strong>, your purchase is complete. Your <strong>${productName} ${denomination}</strong> is ready to ${redeemUrl ? "redeem" : "be activated"}.
      </p>
${redeemUrl ? `
      <div style="text-align: center; margin: 30px 0 10px;">
        <a href="${redeemUrl}" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 17px;">Redeem Gift Card</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center; margin: 0 0 25px; word-break: break-all;">
        Button not working? Open this link: <a href="${redeemUrl}" style="color: #6B3FA0;">${redeemUrl}</a>
      </p>` : `
      <div style="background: linear-gradient(135deg, rgba(107, 63, 160, 0.03) 0%, rgba(77, 168, 218, 0.03) 100%); border: 2px dashed #6B3FA0; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0;">
        <p style="margin: 0 0 10px 0; color: #6B3FA0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">YOUR ACTIVATION PIN</p>
        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; font-size: 26px; font-weight: 700; color: #1f2937; letter-spacing: 3px; word-break: break-all;">
          ${giftcardCode}
        </div>
      </div>`}

${redeemUrl ? "" : `
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 25px 0;">
        For instructions on how to activate your ${productName}, please check the description section on the Byiora product page.
      </p>

      <div style="text-align: center;">
         <a href="https://www.byiora.com.np" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Return to Store</a>
      </div>`}
    </div>

    <div style="background-color: #F4F0F9; border-top: 1px solid #D8CBEB; padding: 20px; text-align: center;">
      <p style="color: #4A2A70; font-size: 13px; margin: 0 0 8px 0;">Need help activating? <a href="https://www.byiora.com.np/contact" style="color: #6B3FA0; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #A58BC5; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>

  </div>
</div>`

  // Non-blocking audience sync with anti-spam check (Only tag Registered USERS if not guest, no names for guests)
  addCustomerToAudience(email, !input.isGuest ? userName : undefined, !input.isGuest).catch(() => {})

  return await resend.emails.send({
    from: "Byiora <order-status@byiora.com.np>",
    replyTo: "support@byiora.com.np",
    to: [email],
    subject: input.subjectOverride || `Your ${productName} ${redeemUrl ? "is ready to redeem" : "Giftcard Code from Byiora"}`,
    html: htmlContent,
  })
}

const TRUSTPILOT_EVALUATE_URL = "https://www.trustpilot.com/evaluate/byiora.com.np"
const TRUSTPILOT_PAGE_URL = "https://www.trustpilot.com/review/byiora.com.np"

/**
 * Review-request email. Table layout with inline styles (Gmail drops unknown
 * CSS); web fonts, gradients and text-shadow are progressive extras with solid
 * fallbacks. Default paddings are already phone-friendly because the Gmail app
 * ignores media queries for non-Gmail accounts.
 */
function renderReviewRequestEmail(firstName: string | null): string {
  const year = new Date().getFullYear()
  const greeting = firstName ? `Hi ${firstName}, your` : "Your"
  const star = `<td width="20%" height="44" align="center" bgcolor="#0E5C6D" style="background-color:#0E5C6D; border:3px solid #FFFFFF; border-radius:12px; font-size:24px; line-height:44px; height:44px;"><a href="${TRUSTPILOT_EVALUATE_URL}" target="_blank" aria-label="Rate your experience on Trustpilot" style="display:block; color:#FFC93C; text-decoration:none;">&#9733;</a></td>`
  const step = (n: number, title: string, text: string, last = false) => `
        <tr>
          <td width="48" valign="top" style="padding:0 0 ${last ? 4 : 20}px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" width="36" height="36" bgcolor="#0E5C6D" style="background-color:#0E5C6D; border-radius:18px; font-family:'Baloo 2','Arial Black',Arial,sans-serif; font-size:18px; font-weight:800; color:#FFFFFF; line-height:36px; height:36px;">${n}</td></tr></table>
          </td>
          <td valign="top" style="padding:0 0 ${last ? 4 : 20}px 0; font-family:'Poppins',Helvetica,Arial,sans-serif;">
            <div style="font-size:15px; font-weight:700; color:#0B3B47; line-height:1.4;">${title}</div>
            <div style="font-size:14px; color:#4A6670; line-height:1.6; margin-top:3px;">${text}</div>
          </td>
        </tr>`
  const reason = (icon: string, text: string) =>
    `<tr><td style="padding:7px 0; font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:14px; color:#0B3B47; line-height:1.55;">${icon}&nbsp; ${text}</td></tr>`

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>How did we do? – Byiora</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&amp;family=Poppins:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<style>
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100% !important; background-color:#FFF8EC; }
  a { text-decoration:none; }
  @media only screen and (max-width:600px) {
    .container { width:100% !important; max-width:100% !important; }
    .outer-pad { padding:12px 8px !important; }
    .hero-pad { padding:34px 18px 32px 18px !important; }
    .hero-title { font-size:32px !important; }
    .card-pad { padding:24px 16px 22px 16px !important; }
    .body-pad { padding:30px 20px !important; }
    .footer-pad { padding:26px 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#FFF8EC;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#FFF8EC;">
Two minutes, a few honest words — help other gamers shop with confidence.
&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF8EC;">
<tr>
<td class="outer-pad" align="center" style="padding:24px 12px;">

<!--[if mso]><table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td><![endif]-->
<table role="presentation" class="container" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%; max-width:600px;">

  <tr>
    <td class="hero-pad" align="center" bgcolor="#F2711C" style="background-color:#F2711C; background-image:radial-gradient(circle at 50% 8%, #FFC157 0%, #FFB443 30%, #F2711C 75%); border-radius:20px 20px 0 0; padding:40px 24px 36px 24px;">

      <a href="https://www.byiora.com.np" target="_blank">
        <img src="https://www.byiora.com.np/byiora-logo-full.png" width="150" alt="Byiora" style="display:block; margin:0 auto; width:150px; max-width:55%; height:auto;">
      </a>

      <div class="hero-title" style="font-family:'Baloo 2','Arial Black',Arial,sans-serif; font-size:38px; line-height:1.15; font-weight:800; color:#FFFFFF; text-shadow:2px 2px 0 #0E5C6D, -1px -1px 0 #0E5C6D, 1px -1px 0 #0E5C6D, -1px 1px 0 #0E5C6D; margin:22px 0 0 0; letter-spacing:0.5px;">
        HOW DID WE DO?
      </div>

      <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; line-height:1.6; color:#0B3B47; max-width:400px; margin:12px auto 0 auto;">
        ${greeting} honest review helps other gamers shop with confidence.
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" align="center" width="100%" style="max-width:380px; margin:26px auto 0 auto;">
        <tr>
          <td class="card-pad" align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; border-radius:20px; padding:26px 18px 24px 18px;">
            <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; color:#0E5C6D; text-transform:uppercase; margin:0 0 14px 0;">Rate your experience</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center" style="max-width:250px; margin:0 auto;">
              <tr>${star}${star}${star}${star}${star}</tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:22px auto 0 auto;">
              <tr>
                <td align="center" bgcolor="#0E5C6D" style="background-color:#0E5C6D; border-radius:999px;">
                  <a href="${TRUSTPILOT_EVALUATE_URL}" target="_blank" style="display:inline-block; padding:15px 32px; font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:999px;">Write a Review &rarr;</a>
                </td>
              </tr>
            </table>
            <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:#5C7782; margin:14px 0 0 0;">Opens Trustpilot &middot; takes about 2 minutes</div>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <tr>
    <td class="body-pad" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:36px 28px 32px 28px;">

      <div style="font-family:'Baloo 2','Arial Black',Arial,sans-serif; font-size:24px; font-weight:800; color:#0B3B47; text-align:center; margin:0 0 6px 0;">Three quick steps</div>
      <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.6; color:#5C7782; text-align:center; margin:0 0 26px 0;">No essay required — a few honest lines is plenty.</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${step(1, "Tap the button", "It opens our page on Trustpilot — sign in or create a free account.")}${step(2, "Pick your stars", "Rate your overall experience honestly, whatever it was.")}${step(3, "Add a few words", "What did you order? How were delivery and support? Anything we could do better?", true)}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
        <tr>
          <td bgcolor="#FFF8EC" style="background-color:#FFF8EC; border-radius:16px; padding:22px 20px;">
            <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; color:#0E5C6D; text-transform:uppercase; margin:0 0 10px 0;">Why your review matters</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${reason("🎮", "Helps fellow gamers decide where to buy keys and gift cards")}
              ${reason("💬", "Shows us what we're getting right — and what to fix")}
              ${reason("🤝", "Supports our Nepal-based store")}
            </table>
          </td>
        </tr>
      </table>

      <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.7; color:#0B3B47; text-align:center; max-width:420px; margin:30px auto 0 auto;">
        Thank you for shopping with Byiora. Whether it was great or could have been better, we genuinely want to hear it.
      </div>
      <div style="font-family:'Baloo 2','Arial Black',Arial,sans-serif; font-size:18px; font-weight:800; color:#0E5C6D; text-align:center; margin-top:10px;">— Team Byiora</div>

      <div style="border-top:1px solid #F1E7D6; margin-top:28px; padding-top:18px; font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.9; color:#5C7782; text-align:center;">
        Button not working? Copy this link into your browser:<br>
        <a href="${TRUSTPILOT_EVALUATE_URL}" target="_blank" style="color:#0E5C6D; text-decoration:underline; word-break:break-all;">trustpilot.com/evaluate/byiora.com.np</a><br>
        <a href="${TRUSTPILOT_PAGE_URL}" target="_blank" style="color:#0E5C6D; text-decoration:underline;">See our Trustpilot page</a>
      </div>

    </td>
  </tr>

  <tr>
    <td class="footer-pad" align="center" bgcolor="#0B3B47" style="background-color:#0B3B47; border-radius:0 0 20px 20px; padding:30px 24px;">
      <div style="font-family:'Baloo 2','Arial Black',Arial,sans-serif; font-size:22px; font-weight:800; color:#FFFFFF;">Byiora</div>
      <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#BFE1E8; margin-top:6px;">Digital Gift Cards for Gamers &amp; Streamers</div>
      <div style="font-family:'Poppins',Helvetica,Arial,sans-serif; font-size:11px; line-height:1.8; color:#9AC4CC; margin-top:18px; max-width:400px;">
        You're receiving this one-time request because you recently shopped at Byiora.<br>
        <a href="mailto:support@byiora.com.np?subject=No%20more%20review%20requests" style="color:#BFE1E8; text-decoration:underline;">Don't ask me again</a> &nbsp;&bull;&nbsp; &copy; ${year} Byiora. All rights reserved.
      </div>
    </td>
  </tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->

</td>
</tr>
</table>

</body>
</html>`
}

export async function sendReviewRequestEmail(input: { email: string; userName?: string }) {
  const resend = getResend()
  const email = input.email.trim().toLowerCase()
  // First name only, and never the email-derived fallback (e.g. "john.doe92").
  const raw = (input.userName || "").trim()
  const first = raw && !raw.includes("@") && raw.toLowerCase() !== email.split("@")[0] ? sanitizeHtml(raw.split(/\s+/)[0]) : null

  return await resend.emails.send({
    from: "Byiora <support@byiora.com.np>",
    replyTo: "support@byiora.com.np",
    to: [email],
    subject: "How did we do? Rate your Byiora order",
    html: renderReviewRequestEmail(first),
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

export async function sendPasswordResetEmail(input: {
  email: string
  resetLink: string
}) {
  const resend = getResend()
  const email = input.email.trim().toLowerCase()
  const resetLink = input.resetLink

  const htmlContent = `
<div style="background-color: #f3f4f6; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #6B3FA0; padding: 35px 40px; text-align: center;">
      <img src="https://www.byiora.com.np/logo-final.png" alt="BYIORA" style="height: 45px; margin: 0 auto; display: block;" onerror="this.outerHTML='<h1 style=\\'color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;\\'>BYIORA</h1>'" />
      <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Password Reset Request</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1E1E1E; font-size: 22px; margin-top: 0; text-align: center;">Reset Your Password</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-top: 20px;">
        A password reset has been requested for your Byiora account (<strong>${email}</strong>). Click the button below to choose a new password.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(107, 63, 160, 0.2);">Reset My Password</a>
      </div>

      <div style="margin: 30px 0; padding: 16px 20px; background-color: #FEF7E0; border: 1px solid #F59E0B; border-radius: 8px;">
        <p style="color: #92400E; font-size: 13px; margin: 0; line-height: 1.5; text-align: center;">
          This link is valid for 24 hours. If you did not request this change, you can safely ignore this email and your password will remain unchanged.
        </p>
      </div>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">Need help? <a href="https://www.byiora.com.np/contact" style="color: #4DA8DA; text-decoration: none; font-weight: 600;">Contact Support</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Byiora. All rights reserved.</p>
    </div>
  </div>
</div>
  `

  return await resend.emails.send({
    from: "Byiora Security <support@byiora.com.np>",
    replyTo: "support@byiora.com.np",
    to: [email],
    subject: "Reset your Byiora account password",
    html: htmlContent,
  })
}

