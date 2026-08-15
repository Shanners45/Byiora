import crypto from "crypto"

/**
 * Decrypt an inventory code using the INVENTORY_ENCRYPTION_KEY.
 * Shared utility to avoid duplication across webhook routes.
 */
export function decryptInventoryCode(encryptedBlob: string): string | null {
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
