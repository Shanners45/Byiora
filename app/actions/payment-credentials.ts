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
  
  for (const row of data as any[]) {
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
    let plainPasswordToVerify = password
    if (password) {
      encryptedPassword = await encryptBankCredentials(password)
    } else {
      // If we are updating username but no new password is provided, we need to decrypt the old one to verify
      if (existing?.encrypted_password) {
        plainPasswordToVerify = (await decryptBankCredentials(existing.encrypted_password)) || undefined
      }
    }

    if (!encryptedPassword || !plainPasswordToVerify) {
      return { error: "Password is required for new credentials" }
    }

    // --- VERIFY LOGIN WITH PROXY BEFORE SAVING ---
    let merchantCode = null;
    const providerLower = provider.toLowerCase();
    const isNepalPay = providerLower === "nepalpay" || providerLower.includes("nepal pay");
    const isFonepay = providerLower === "fonepay";
    const isKhalti = providerLower === "khalti";

    if (isNepalPay || isFonepay) {
      const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
      const PROXY_SECRET = process.env.INTERNAL_API_SECRET!
      if (!PROXY_SECRET) return { error: "INTERNAL_API_SECRET is not configured." }

      // Use the provider-specific verify-login endpoint on the unified proxy
      const verifyEndpoint = isFonepay ? "/api/fonepay/verify-login" : "/api/nepalpay/verify-login";

      try {
        const verifyRes = await fetch(`${PROXY_URL}${verifyEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": PROXY_SECRET
          },
          body: JSON.stringify({
            username: username,
            password: plainPasswordToVerify,
          })
        })
        const verifyData = await verifyRes.json()
        if (!verifyData.success) {
          return { error: "Bank Verification Failed: " + (verifyData.message || "Invalid credentials") }
        }
        merchantCode = verifyData.merchantCode || null;
      } catch (e) {
        return { error: "Failed to connect to bank proxy for verification." }
      }
    } else if (isKhalti) {
      try {
        const cleanUser = username.trim()
        const authHeader = cleanUser.startsWith("Key ") ? cleanUser : `Key ${cleanUser}`
        const isLive = cleanUser.toLowerCase().startsWith("live_")
        const url = isLive 
          ? "https://khalti.com/api/v2/epayment/lookup/" 
          : "https://dev.khalti.com/api/v2/epayment/lookup/";
          
        let verifyRes = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ pidx: "dummy_pidx_to_verify_key" })
        });

        if (verifyRes.status === 401 || verifyRes.status === 403) {
          const alternateUrl = url.includes("dev.khalti.com")
            ? "https://khalti.com/api/v2/epayment/lookup/"
            : "https://dev.khalti.com/api/v2/epayment/lookup/"
          verifyRes = await fetch(alternateUrl, {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ pidx: "dummy_pidx_to_verify_key" })
          })
        }
        
        if (verifyRes.status === 401 || verifyRes.status === 403) {
          return { error: "Khalti Verification Failed: Invalid Secret Key (401). Please ensure you enter the Secret Key (starts with 5e777...), NOT the Public Key (starts with 6d06a...)." }
        }
        merchantCode = "Verified";
      } catch (e) {
        return { error: "Failed to connect to Khalti for verification." }
      }
    }

    const { error } = await (supabase
      .from("payment_credentials")
      .upsert({
        provider: provider.toLowerCase(),
        encrypted_username: encryptedUsername,
        encrypted_password: encryptedPassword,
        updated_at: new Date().toISOString()
      } as any) as any)

    if (error) return { error: error.message }
    return { success: true, merchantCode }

  } catch (error: any) {
    console.error("Save credentials error:", error)
    return { error: error.message || "Failed to save credentials" }
  }
}
