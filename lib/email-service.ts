import emailjs from "@emailjs/browser"
import { sendEmailFallback } from "./email-fallback"
import { headers } from "next/headers"

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? ""
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? ""
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? ""

/**
 * Helper to determine if code is running on server
 */
const isServer = () => typeof window === "undefined"

export interface OrderEmailData {
  to_email: string
  to_name: string
  product_name: string
  product_image_url: string
  logo_url: string
  order_amount: string
  order_price: string
  transaction_id: string
  order_date: string
  payment_method: string
}

/**
 * Send a welcome email to a newly registered user
 * Calls the /api/send-welcome API route
 * Works on both client and server sides
 */
export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  try {
    if (!email || !email.includes("@")) {
      console.error("Invalid email address for welcome email:", email)
      return false
    }

    // Construct URL - use absolute URL on server, relative on client
    let url: string
    if (isServer()) {
      const headerList = await headers()
      const host = headerList.get("host")
      const protocol = host?.includes("localhost") ? "http" : "https"
      url = `${protocol}://${host}/api/send-welcome`
    } else {
      url = "/api/send-welcome"
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        userName: name,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      console.error("Failed to send welcome email:", errorData.error)
      return false
    }

    console.log("Welcome email sent successfully to:", email)
    return true
  } catch (error) {
    console.error("Error sending welcome email:", error)
    return false
  }
}

export const sendOrderConfirmationEmail = async (orderData: OrderEmailData): Promise<boolean> => {
  try {
    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      console.warn("EmailJS is not configured; set NEXT_PUBLIC_EMAILJS_* env vars.")
      return sendEmailFallback(orderData)
    }

    // Validate email address
    if (!orderData.to_email || !orderData.to_email.includes("@")) {
      console.error("Invalid email address:", orderData.to_email)
      return false
    }

    // EmailJS template parameters - using common parameter names
    const templateParams = {
      user_email: orderData.to_email,
      user_name: orderData.to_name,
      product_name: orderData.product_name,
      product_image_url: orderData.product_image_url,
      logo_url: orderData.logo_url,
      order_amount: orderData.order_amount,
      order_price: orderData.order_price,
      transaction_id: orderData.transaction_id,
      order_date: orderData.order_date,
      payment_method: orderData.payment_method,
      from_name: "Byiora Team",
      reply_to: "support@byiora.com",
      to_email: orderData.to_email,
      to_name: orderData.to_name,
      email: orderData.to_email,
      name: orderData.to_name,
    }

    console.log("Attempting to send email via EmailJS with enhanced data...")

    const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)

    console.log("Email sent successfully via EmailJS:", response)
    return true
  } catch (error) {
    console.error("EmailJS failed, trying fallback method:", error)

    // Try fallback method
    try {
      return await sendEmailFallback(orderData)
    } catch (fallbackError) {
      console.error("Fallback email also failed:", fallbackError)
      return false
    }
  }
}
