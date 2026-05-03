"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import crypto from "crypto"
import { verifyAdmin } from "./admin-utils"

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
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(JSON.stringify(checkoutData), "utf8", "hex")
    encrypted += cipher.final("hex")
    const authTag = cipher.getAuthTag().toString("hex")

    const encryptedBlob = `${iv.toString("hex")}:${authTag}:${encrypted}`

    // Store in the transactions table
    const serviceSupabase = createServiceRoleClient()
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
