import crypto from "crypto"

/**
 * Server-only bank credential encryption helpers.
 *
 * IMPORTANT: This module must NOT have the "use server" directive. These
 * helpers use BANK_CREDENTIALS_ENCRYPTION_KEY and must never be exposed as
 * callable RPC endpoints — otherwise anyone who can read payment_credentials
 * rows could ask the server to decrypt them.
 */

function getBankEncryptionKey(): Buffer {
  const key = process.env.BANK_CREDENTIALS_ENCRYPTION_KEY
  if (!key) {
    throw new Error("BANK_CREDENTIALS_ENCRYPTION_KEY environment variable is not set")
  }
  return Buffer.from(key, "hex")
}

export function encryptBankCredentials(text: string): string {
  const key = getBankEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

export function decryptBankCredentials(encryptedBlob: string): string | null {
  const key = getBankEncryptionKey()
  const parts = encryptedBlob.split(":")
  if (parts.length !== 3) return null

  const [ivHex, authTagHex, ciphertext] = parts
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}
