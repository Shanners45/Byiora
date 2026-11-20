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

/**
 * Server-issued proof that the caller created this transaction. Handed back
 * only from the order-creation action so an attacker cannot write checkout
 * credentials into somebody else's pending order by guessing its ID.
 */
export function createCheckoutCapability(transactionId: string): string {
  return crypto
    .createHmac("sha256", getCheckoutEncryptionKey())
    .update(`checkout-capability:v1:${transactionId}`)
    .digest("hex")
}

export function verifyCheckoutCapability(transactionId: string, capability: string): boolean {
  if (!capability || typeof capability !== "string") return false
  const expected = Buffer.from(createCheckoutCapability(transactionId), "hex")
  const provided = Buffer.from(capability, "hex")
  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(expected, provided)
}
