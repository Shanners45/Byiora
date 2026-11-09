import crypto from "crypto"

/**
 * Server-only checkout encryption key derivation.
 * Must NOT be marked "use server" — this is a plain helper module.
 */
export function getCheckoutEncryptionKey(): Buffer {
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
