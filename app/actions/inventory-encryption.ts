import crypto from "crypto"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { headers } from "next/headers"

// Only initialized if URL is present (so it doesn't crash on build if missing)
let ratelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, "1 m"), // 50 requests per minute
  })
}

function getInventoryEncryptionKey(): Buffer {
  const key = process.env.INVENTORY_ENCRYPTION_KEY
  if (!key) {
    throw new Error("INVENTORY_ENCRYPTION_KEY environment variable is not set")
  }
  return Buffer.from(key, "hex")
}

export function generateCodeHash(code: string): string {
  const key = process.env.INVENTORY_ENCRYPTION_KEY
  if (!key) {
    throw new Error("INVENTORY_ENCRYPTION_KEY environment variable is not set")
  }
  return crypto.createHmac("sha256", Buffer.from(key, "hex")).update(code.trim()).digest("hex")
}

export async function encryptInventoryCode(code: string) {
  try {
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1"
    if (ratelimit) {
      const { success } = await ratelimit.limit(`encrypt-inventory:${ip}`)
      if (!success) {
        return { error: "Too many requests. Please try again later." }
      }
    }

    const key = getInventoryEncryptionKey()
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)

    let encrypted = cipher.update(code.trim(), "utf8", "hex")
    encrypted += cipher.final("hex")
    const authTag = cipher.getAuthTag().toString("hex")

    const encryptedBlob = `${iv.toString("hex")}:${authTag}:${encrypted}`
    
    // Also generate the hash for deduplication
    const codeHash = generateCodeHash(code)

    return { success: true, encryptedBlob, codeHash }
  } catch (error: any) {
    console.error("Inventory Code Encryption error:", error)
    return { error: error.message || "Encryption failed" }
  }
}

export async function decryptInventoryCode(encryptedBlob: string) {
  try {
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1"
    if (ratelimit) {
      const { success } = await ratelimit.limit(`decrypt-inventory:${ip}`)
      if (!success) {
        return { error: "Too many requests. Please try again later." }
      }
    }

    const key = getInventoryEncryptionKey()
    const parts = encryptedBlob.split(":")
    if (parts.length !== 3) {
      return { error: "Invalid encrypted data format" }
    }
    
    const [ivHex, authTagHex, ciphertext] = parts
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return { success: true, decrypted }
  } catch (error: any) {
    console.error("Inventory Code Decryption error:", error)
    return { error: error.message || "Decryption failed" }
  }
}
