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

// Purpose binding: checkout blobs use the same key, so without distinct AAD a
// checkout ciphertext could be replayed as a guest token.
const TOKEN_AAD = Buffer.from("byiora:guest-verification:v2", "utf8")
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 60_000
const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9-]{6,80}$/

/**
 * Generates an encrypted 24-hour token for guest payment verification.
 */
export async function generateGuestVerificationToken(transactionId: string): Promise<string> {
  const key = getCheckoutEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(TOKEN_AAD)

  const expiry = Date.now() + TOKEN_TTL_MS
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
    decipher.setAAD(TOKEN_AAD)

    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")

    const payload = JSON.parse(decrypted) as { t?: unknown; e?: unknown }
    const now = Date.now()

    if (typeof payload.t !== "string" || !TRANSACTION_ID_PATTERN.test(payload.t)) {
      return { success: false, error: "Invalid token" }
    }
    if (typeof payload.e !== "number" || !Number.isFinite(payload.e)) {
      return { success: false, error: "Invalid token" }
    }
    if (now > payload.e) {
      return { success: false, error: "Token expired" }
    }
    if (payload.e > now + TOKEN_TTL_MS + MAX_CLOCK_SKEW_MS) {
      return { success: false, error: "Invalid token" }
    }

    return { success: true, transactionId: payload.t }
  } catch {
    return { success: false, error: "Invalid or corrupted token" }
  }
}
