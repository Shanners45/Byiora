"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import crypto from "crypto"
import { verifyAdmin } from "./admin-utils"
import { headers } from "next/headers"
import { rateLimit } from "@/lib/rate-limit"

const ALGORITHM = "aes-256-gcm"

function getEncryptionKey(): Buffer {
  const key = process.env.CHECKOUT_ENCRYPTION_KEY
  if (!key) {
    throw new Error("CHECKOUT_ENCRYPTION_KEY environment variable is not set")
  }
  // Accept hex-encoded 32-byte key (64 hex chars) or use SHA-256 hash of whatever string is provided
  if (/^[0-9a-f]{64}$/i.test(key)) {
    return Buffer.from(key, "hex")
  }
  return crypto.createHash("sha256").update(key).digest()
}

/**
 * Encrypts checkout field values (email/password/etc.) server-side.
 * Returns an encrypted blob string (iv:authTag:ciphertext, all hex).
 */
export async function encryptCheckoutData(
  transactionId: string,
  checkoutData: Record<string, string>
) {
  try {
    // SECURITY: Rate-limit to prevent abuse (10 calls/min per IP)
    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = await rateLimit(`encrypt-checkout:${ip}`, { windowMs: 60_000, max: 10 })
    if (!rl.ok) {
      return { error: "Too many requests. Please try again later." }
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
    if (txn.status !== "Processing") {
      return { error: "Transaction is no longer in a valid state for this operation." }
    }
    if (txn.encrypted_checkout_data) {
      return { error: "Checkout data has already been submitted for this transaction." }
    }

    // Encrypt the checkout data
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(JSON.stringify(checkoutData), "utf8", "hex")
    encrypted += cipher.final("hex")
    const authTag = cipher.getAuthTag().toString("hex")

    const encryptedBlob = `${iv.toString("hex")}:${authTag}:${encrypted}`

    // Store in the transactions table
    const { error } = await serviceSupabase
      .from("transactions")
      .update({ encrypted_checkout_data: encryptedBlob })
      .eq("transaction_id", transactionId)

    if (error) {
      console.error("Error storing encrypted data:", error)
      return { error: `Failed to store encrypted data: ${error.message}` }
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
    const key = getEncryptionKey()
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

/**
 * Generates an encrypted 24-hour token for guest payment verification
 */
export async function generateGuestVerificationToken(transactionId: string): Promise<string> {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  // Expiry is exactly 24 hours from now
  const expiry = Date.now() + 24 * 60 * 60 * 1000
  const payload = JSON.stringify({ t: transactionId, e: expiry })
  
  let encrypted = cipher.update(payload, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")

  return Buffer.from(`${iv.toString("hex")}:${authTag}:${encrypted}`).toString('base64')
}

/**
 * Verifies a guest token and returns the transaction ID if valid
 */
export async function verifyGuestVerificationToken(base64Token: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const key = getEncryptionKey()
    const decoded = Buffer.from(base64Token, 'base64').toString('utf8')
    const [ivHex, authTagHex, ciphertext] = decoded.split(":")

    if (!ivHex || !authTagHex || !ciphertext) {
      return { success: false, error: "Invalid token format" }
    }

    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")

    const payload = JSON.parse(decrypted) as { t: string, e: number }
    if (Date.now() > payload.e) {
      return { success: false, error: "Token expired" }
    }

    return { success: true, transactionId: payload.t }
  } catch (error) {
    return { success: false, error: "Invalid or corrupted token" }
  }
}
