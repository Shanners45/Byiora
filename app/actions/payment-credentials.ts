"use server"

import crypto from "crypto"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { verifyAdmin } from "./admin-utils"

function getBankEncryptionKey(): Buffer {
  const key = process.env.BANK_CREDENTIALS_ENCRYPTION_KEY
  if (!key) {
    throw new Error("BANK_CREDENTIALS_ENCRYPTION_KEY environment variable is not set")
  }
  return Buffer.from(key, "hex")
}

export async function encryptBankCredentials(text: string) {
  const key = getBankEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

export async function decryptBankCredentials(encryptedBlob: string) {
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

export async function getPaymentCredentialsAction() {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from("payment_credentials").select("*") as any
  
  if (error) return { error: error.message }
  
  // Decrypt to show in admin dashboard (or we could just return stars, 
  // but usually admin needs to see or we just show if it's set)
  // For security, it's better to just return whether it is configured or not, 
  // but if the user requested "username and password will be asked", they might want to see the username.
  
  const formattedData: Record<string, { username: string, isPasswordSet: boolean }> = {}
  
  for (const row of data) {
    try {
      const username = await decryptBankCredentials(row.encrypted_username)
      formattedData[row.provider] = {
        username: username || "",
        isPasswordSet: true // If row exists, it's set
      }
    } catch {
      // Ignore decrypt errors
    }
  }

  return { success: true, data: formattedData }
}

export async function savePaymentCredentialsAction(provider: string, username: string, password?: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  
  try {
    const supabase = createServiceRoleClient()
    
    // Check if exists
    const { data: existing } = await supabase.from("payment_credentials").select("encrypted_password").eq("provider", provider).single() as any

    const encryptedUsername = await encryptBankCredentials(username)
    
    let encryptedPassword = existing?.encrypted_password
    if (password) {
      encryptedPassword = await encryptBankCredentials(password)
    }

    if (!encryptedPassword) {
      return { error: "Password is required for new credentials" }
    }

    const { error } = await (supabase
      .from("payment_credentials")
      .upsert({
        provider,
        encrypted_username: encryptedUsername,
        encrypted_password: encryptedPassword,
        updated_at: new Date().toISOString()
      }) as any)

    if (error) return { error: error.message }
    return { success: true }

  } catch (error: any) {
    console.error("Save credentials error:", error)
    return { error: error.message || "Failed to save credentials" }
  }
}
