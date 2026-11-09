import crypto from "crypto"
import { getCheckoutEncryptionKey } from "@/lib/crypto/checkout"

/**
 * Server-only guest verification token helpers.
 *
 * IMPORTANT: This module must NOT have the "use server" directive. These
 * functions mint and verify magic-link tokens for guest orders. Exposing the
 * mint function as a Server Action would let anyone generate a valid
 * verification link for an arbitrary transaction ID.
 */

const ALGORITHM = "aes-256-gcm"

/**
 * Generates an encrypted 24-hour token for guest payment verification.
 */
export async function generateGuestVerificationToken(transactionId: string): Promise<string> {
  const key = getCheckoutEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  // Expiry is exactly 24 hours from now
  const expiry = Date.now() + 24 * 60 * 60 * 1000
  const payload = JSON.stringify({ t: transactionId, e: expiry })

  let encrypted = cipher.update(payload, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")

  return Buffer.from(`${iv.toString("hex")}:${authTag}:${encrypted}`).toString("base64")
}

/**
 * Verifies a guest token and returns the transaction ID if valid.
 */
export async function verifyGuestVerificationToken(base64Token: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const key = getCheckoutEncryptionKey()
    const decoded = Buffer.from(base64Token, "base64").toString("utf8")
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

    const payload = JSON.parse(decrypted) as { t: string; e: number }
    if (Date.now() > payload.e) {
      return { success: false, error: "Token expired" }
    }

    return { success: true, transactionId: payload.t }
  } catch {
    return { success: false, error: "Invalid or corrupted token" }
  }
}
