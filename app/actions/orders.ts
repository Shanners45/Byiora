"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

import { verifyAdmin } from "./admin-utils"

import crypto from "crypto"

function decryptInventoryCodeSync(encryptedBlob: string): string | null {
  try {
    const key = process.env.INVENTORY_ENCRYPTION_KEY
    if (!key) return null
    const parts = encryptedBlob.split(":")
    if (parts.length !== 3) return null
    const [ivHex, authTagHex, ciphertext] = parts
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    return null
  }
}

/**
 * Updates transaction status (admin only)
 * Uses Service Role to bypass RLS
 */
export async function updateTransactionStatusAction(
  transactionId: string,
  newStatus: "Completed" | "Failed" | "Processing" | "Archived" | "Refunded" | "Payment Pending" | "Paid" | "Payment Failed" | "Cancelled",
  remarks?: string
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    let finalStatus = newStatus;
    let deliveredCode: string | null = null;
    let decryptedCode: string | null = null;
    let emailSent = false;

    // Fetch transaction details
    const { data: _txn } = await serviceSupabase
      .from("transactions")
      .select("*, users(name)")
      .eq("transaction_id", transactionId)
      .single()
    const txn = _txn as any;

    // Auto-fulfill if status is Paid
    if (newStatus === "Paid" && txn) {
      const categoriesWithInventory = ["digital-goods", "games"]
      
      if ((txn as any).product_category && categoriesWithInventory.includes((txn as any).product_category.toLowerCase())) {
        const { data: claimData, error: claimError } = await serviceSupabase.rpc("claim_gift_card", {
          p_product_id: txn.product_id,
          p_denomination_label: txn.amount,
          p_transaction_id: transactionId,
          p_user_id: txn.user_id || txn.user_email
        } as any)

        if (!claimError && claimData && (claimData as any).length > 0 && (claimData as any)[0].encrypted_code) {
          deliveredCode = (claimData as any)[0].encrypted_code
          decryptedCode = decryptInventoryCodeSync(deliveredCode as string)
          
          if (decryptedCode) {
            finalStatus = "Completed"
          }
        }
      }
    }

    const updatePayload: any = { status: finalStatus }
    if (remarks !== undefined) updatePayload.failure_remarks = remarks
    if (decryptedCode) {
      updatePayload.giftcard_code = decryptedCode
    } else if (deliveredCode) {
      updatePayload.giftcard_code = deliveredCode
    }

    const { error } = await serviceSupabase
      .from("transactions")
      .update(updatePayload)
      .eq("transaction_id", transactionId)

    if (error) {
      console.error("Error updating transaction status:", error)
      return { error: `Failed to update status: ${error.message}` }
    }

    // Send emails if auto-fulfillment logic triggered
    if (newStatus === "Paid" && txn) {
      let userName = undefined
      if (txn.users?.name) {
        userName = txn.users.name
      } else if (txn.guest_user_data?.name) {
        userName = txn.guest_user_data.name
      }

      const { sendOrderPlacedEmail, sendGiftcardCodeEmail } = await import("@/lib/email/resend")

      try {
        if (decryptedCode) {
          await sendGiftcardCodeEmail({
            email: txn.user_email,
            userName: userName,
            productName: txn.product_name,
            denomination: txn.amount,
            transactionId: transactionId,
            price: txn.price,
            paymentMethod: txn.payment_method,
            giftcardCode: decryptedCode,
            isGuest: !txn.user_id
          })
          emailSent = true
        } else {
          await sendOrderPlacedEmail({
            email: txn.user_email,
            userName: userName,
            productName: txn.product_name,
            denomination: txn.amount,
            transactionId: transactionId,
            price: txn.price,
            paymentMethod: txn.payment_method,
            isGuest: !txn.user_id
          })
          
          if (process.env.DISCORD_WEBHOOK_URL) {
            try {
              await fetch(process.env.DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  embeds: [{
                    title: "⚠️ MANUAL DELIVERY REQUIRED - PAID ORDER",
                    color: 0xFF5722,
                    fields: [
                      { name: "Order ID", value: transactionId, inline: true },
                      { name: "Product", value: txn.product_name, inline: false },
                      { name: "Amount", value: `Rs. ${txn.price}`, inline: true },
                    ],
                    timestamp: new Date().toISOString()
                  }]
                })
              })
            } catch (e) {}
          }
        }
      } catch (emailErr) {
        console.error("Failed to send fulfillment email:", emailErr)
      }
    }

    revalidatePath("/admin/dashboard/orders")
    return { success: true, finalStatus, giftcardCode: decryptedCode || null, emailSent }
  } catch (error: any) {
    console.error("Error in updateTransactionStatusAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Sends giftcard code and marks order as completed (admin only)
 * Uses Service Role to bypass RLS
 */
export async function sendGiftcardCodeAction(
  transactionId: string,
  code: string
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data: _txn } = await serviceSupabase
      .from("transactions")
      .select("*, users(name)")
      .eq("transaction_id", transactionId)
      .single()
    const txn = _txn as any;

    const { error } = await serviceSupabase
      .from("transactions")
      .update({
        giftcard_code: code,
        status: "Completed",
      })
      .eq("transaction_id", transactionId)

    if (error) {
      console.error("Error sending giftcard code:", error)
      return { error: `Failed to send giftcard code: ${error.message}` }
    }

    if (txn && txn.user_email) {
      const { sendGiftcardCodeEmail } = await import("@/lib/email/resend")
      
      let userName = "Customer"
      if (txn.users && txn.users.name) {
        userName = txn.users.name
      } else if (txn.guest_user_data && txn.guest_user_data.name) {
        userName = txn.guest_user_data.name
      }

      await sendGiftcardCodeEmail({
        email: txn.user_email,
        userName: userName,
        productName: txn.product_name || "Gift Card",
        denomination: txn.amount || "",
        transactionId: txn.transaction_id,
        price: String(txn.price) || "",
        paymentMethod: txn.payment_method || "Unknown",
        giftcardCode: code,
        isGuest: !txn.user_id
      }).catch(e => console.error("Failed to send gift code email:", e))
    }

    revalidatePath("/admin/dashboard/orders")
    return { success: true }
  } catch (error: any) {
    console.error("Error in sendGiftcardCodeAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets transaction details by ID (admin only)
 * Uses Service Role to bypass RLS and access any transaction
 */
export async function getTransactionByIdAction(transactionId: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()

    if (error) {
      console.error("Error fetching transaction:", error)
      return { error: `Failed to fetch transaction: ${error.message}` }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("Error in getTransactionByIdAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Inserts notification for user (admin only)
 * Uses Service Role to bypass RLS
 */
export async function insertNotificationAction(
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error",
  userId: string
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from("notifications")
      .insert([
        {
          title,
          message,
          type,
          user_id: userId,
          is_read: false,
        },
      ])

    if (error) {
      console.error("Error inserting notification:", error)
      return { error: `Failed to send notification: ${error.message}` }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error in insertNotificationAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
