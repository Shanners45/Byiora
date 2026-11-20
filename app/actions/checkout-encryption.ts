"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import crypto from "crypto"
import { verifyAdmin } from "./admin-utils"
import { headers } from "next/headers"
import { rateLimit } from "@/lib/rate-limit"
import { getCheckoutEncryptionKey, verifyCheckoutCapability } from "@/lib/crypto/checkout"

const ALGORITHM = "aes-256-gcm"

// SECURITY: guest magic-link token helpers live in a plain server module
// (not a Server Action) — see lib/crypto/guest-token.ts.

/**
 * Encrypts checkout field values (email/password/etc.) server-side.
 * Returns an encrypted blob string (iv:authTag:ciphertext, all hex).
 */
export async function encryptCheckoutData(
  transactionId: string,
  checkoutData: Record<string, string>,
  checkoutCapability: string
) {
  try {
    // SECURITY: Rate-limit to prevent abuse (10 calls/min per IP)
    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = await rateLimit(`encrypt-checkout:${ip}`, { windowMs: 60_000, max: 10 })
    if (!rl.ok) {
      return { error: "Too many requests. Please try again later." }
    }

    // SECURITY: The capability is minted by the order-creation action and is
    // bound to this transaction, so knowing a transaction ID is not enough.
    if (!verifyCheckoutCapability(transactionId, checkoutCapability)) {
      return { error: "Invalid checkout session." }
    }

    const serviceSupabase = createServiceRoleClient()

    // SECURITY: Verify transaction exists, is freshly created (Processing),
    // and doesn't already have encrypted data (prevents overwrites)
    const { data: txn, error: txnError } = await serviceSupabase
      .from("transactions")
      .select("status, encrypted_checkout_data")
      .eq("transaction_id", transactionId)
      .single()

    if (txnError || !txn) {
      return { error: "Transaction not found." }
    }
    if (!["Processing", "Payment Pending"].includes(txn.status)) {
      return { error: "Transaction is no longer in a valid state for this operation." }
    }
    if (txn.encrypted_checkout_data) {
      return { error: "Checkout data has already been submitted for this transaction." }
    }

    // Encrypt the checkout data
    const key = getCheckoutEncryptionKey()
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(JSON.stringify(checkoutData), "utf8", "hex")
    encrypted += cipher.final("hex")
    const authTag = cipher.getAuthTag().toString("hex")

    const encryptedBlob = `${iv.toString("hex")}:${authTag}:${encrypted}`

    // Store atomically: only the first writer wins.
    const { data: updated, error } = await serviceSupabase
      .from("transactions")
      .update({ encrypted_checkout_data: encryptedBlob })
      .eq("transaction_id", transactionId)
      .is("encrypted_checkout_data", null)
      .select("id")

    if (error) {
      console.error("Error storing encrypted data:", error)
      return { error: `Failed to store encrypted data: ${error.message}` }
    }
    if (!updated || updated.length === 0) {
      return { error: "Checkout data has already been submitted for this transaction." }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Encryption error:", error)
    return { error: error.message || "Encryption failed" }
  }
}

/**
 * Decrypts checkout field values for admin viewing.
 * Only accessible by verified admins.
 */
export async function decryptCheckoutData(encryptedBlob: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const key = getCheckoutEncryptionKey()
    const [ivHex, authTagHex, ciphertext] = encryptedBlob.split(":")

    if (!ivHex || !authTagHex || !ciphertext) {
      return { error: "Invalid encrypted data format" }
    }

    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return { success: true, data: JSON.parse(decrypted) as Record<string, string> }
  } catch (error: any) {
    console.error("Decryption error:", error)
    return { error: "Failed to decrypt data" }
  }
}

/**
 * Clears encrypted checkout data after order completion.
 * Called when admin marks a direct-login order as "Completed".
 */
export async function clearCheckoutData(transactionId: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const { error } = await serviceSupabase
      .from("transactions")
      .update({ encrypted_checkout_data: null })
      .eq("transaction_id", transactionId)

    if (error) {
      console.error("Error clearing checkout data:", error)
      return { error: `Failed to clear data: ${error.message}` }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error in clearCheckoutData:", error)
    return { error: error.message || "Failed to clear data" }
  }
}

