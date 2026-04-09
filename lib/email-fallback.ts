import type { OrderEmailData } from "./email-service"

export const sendEmailFallback = async (orderData: OrderEmailData): Promise<boolean> => {
  try {
    console.log("Attempting fallback email method...")

    // In a real implementation, you would use a different email service here
    // For now, we'll just log the data and return true to simulate success
    console.log("Fallback email data:", {
      to: orderData.to_email,
      subject: `Order Confirmation - ${orderData.product_name}`,
      product_name: orderData.product_name,
      product_image_url: orderData.product_image_url,
      logo_url: orderData.logo_url,
      order_amount: orderData.order_amount,
      order_price: orderData.order_price,
      transaction_id: orderData.transaction_id,
      payment_method: orderData.payment_method,
      order_date: orderData.order_date,
    })

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return true
  } catch (error) {
    console.error("Fallback email method failed:", error)
    return false
  }
}
