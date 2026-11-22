"use server"

import crypto from "crypto"
import { createClient as createPlainClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { verifyTurnstileToken } from "@/lib/captcha"
import { checkLoginRateLimit } from "@/lib/upstash-rate-limit"
import { rateLimit } from "@/lib/rate-limit"
import { recordAbuse, getLockMinutes } from "@/lib/security/auto-ban"
import { getCheckoutEncryptionKey } from "@/lib/crypto/checkout"
import { sendMerchantEmail, sendPasswordChangedEmail } from "@/lib/email/resend"
import { audit, clientIp, getMerchantContext, merchantDb, requireMerchant, type MerchantStage } from "@/lib/merchant/server"
import { KYC_DOC_TYPES, KYC_MAX_BYTES, KYC_MIME, REQUIRED_KYC_DOCS, sniffMime, type KycDocType } from "@/lib/merchant/kyc"

type Result = { success: true } | { success: false; error: string }
const fail = (error: string) => ({ success: false as const, error })

// ── Session ──────────────────────────────────────────────────────────────

export type MerchantView = {
  id: string
  businessName: string
  contactName: string
  email: string
  phone: string | null
  status: "active" | "suspended" | "banned"
  statusReason: string | null
  kycStatus: "not_submitted" | "submitted" | "more_info" | "rejected" | "approved"
  balancePaisa: number
  createdAt: string
}

/** What the portal shows: null when signed out or not a merchant. */
export async function getMerchantStateAction(): Promise<{ merchant: MerchantView; stage: MerchantStage; mfaEnabled: boolean; canUse: boolean; unreadNotifications: number } | null> {
  const ctx = await getMerchantContext()
  if (!ctx) return null
  const m = ctx.merchant
  // Unread = their own messages and broadcasts since they joined, newer than the last time they opened Notifications.
  let unread = merchantDb().from("merchant_notifications").select("id", { count: "exact", head: true }).or(`merchant_id.is.null,merchant_id.eq.${m.id}`).gte("created_at", m.created_at)
  if (m.notifications_seen_at) unread = unread.gt("created_at", m.notifications_seen_at)
  const { count: unreadNotifications } = await unread
  return {
    unreadNotifications: unreadNotifications || 0,
    merchant: {
      id: m.id,
      businessName: m.business_name,
      contactName: m.contact_name,
      email: m.email,
      phone: m.phone,
      status: m.status,
      statusReason: m.status_reason,
      kycStatus: m.kyc_status,
      balancePaisa: m.wallet_balance_paisa,
      createdAt: m.created_at,
    },
    stage: ctx.stage,
    mfaEnabled: ctx.mfaEnabled,
    canUse: ctx.stage === "ready" && m.status === "active" && m.kyc_status === "approved",
  }
}

export async function loginMerchantAction(email: string, password: string, captchaToken: string): Promise<{ success: true; stage: MerchantStage } | { success: false; error: string }> {
  const ip = (await clientIp()) || "unknown"
  const cleanEmail = String(email || "").trim().toLowerCase()
  const tooMany = "Too many attempts. Please try again in a few minutes."

  if (!(await checkLoginRateLimit(`merchant-login:${ip}`)).success) return fail(tooMany)
  if (!(await rateLimit(`merchant-login-email:${cleanEmail}`, { windowMs: 900_000, max: 5 })).ok) return fail(tooMany)
  if (!(await verifyTurnstileToken(captchaToken, ip))) return fail("Captcha validation failed. Please retry.")

  const lockedFor = await getLockMinutes("merchant_login_failure", { email: cleanEmail, ip })
  if (lockedFor > 0) return fail(`Sign-in is locked for ${lockedFor} more minute${lockedFor === 1 ? "" : "s"} after repeated failures.`)

  const supabase = await createClient({ merchant: true })
  const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
  if (error?.code === "user_banned") return fail("This merchant account has been closed.")
  if (error || !data.user) {
    await recordAbuse("merchant_login_failure", { email: cleanEmail, ip })
    return fail("Invalid email or password.")
  }

  const ctx = await getMerchantContext()
  if (!ctx) {
    await supabase.auth.signOut({ scope: "local" })
    return fail("No merchant account for this login.")
  }
  await merchantDb().from("merchants").update({ last_login_at: new Date().toISOString() }).eq("id", ctx.merchant.id)
  await audit({ actorType: "merchant", actorId: ctx.merchant.user_id, merchantId: ctx.merchant.id, action: "merchant.login" })
  return { success: true, stage: ctx.stage }
}

export async function logoutMerchantAction(): Promise<void> {
  await (await createClient({ merchant: true })).auth.signOut({ scope: "local" })
}

// ── First-login steps ────────────────────────────────────────────────────

function checkPasswordStrength(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "Use at least 10 characters."
  if (pw.length > 72) return "Use at most 72 characters."
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Use both letters and numbers."
  return null
}

/** First login: no current password needed (they just signed in with the temporary one). Later: current password required. */
export async function changeMerchantPasswordAction(newPassword: string, currentPassword?: string): Promise<Result> {
  const ctx = await requireMerchant("signed_in")
  if ("error" in ctx) return fail(ctx.error)
  const m = ctx.merchant
  const weak = checkPasswordStrength(newPassword)
  if (weak) return fail(weak)
  if (!(await rateLimit(`merchant-pw:${m.id}`, { windowMs: 900_000, max: 5 })).ok) return fail("Too many attempts. Try again later.")

  if (!m.must_change_password) {
    // Verify the current password on a throwaway client so the browser session is untouched.
    const probe = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await probe.auth.signInWithPassword({ email: m.email, password: currentPassword || "" })
    if (error) return fail("Your current password is wrong.")
    await probe.auth.signOut({ scope: "local" })
  }
  if (newPassword === currentPassword) return fail("Choose a password different from the current one.")

  const db = merchantDb()
  const { error } = await db.auth.admin.updateUserById(m.user_id, { password: newPassword })
  if (error) return fail(/same|different/i.test(error.message) ? "Choose a password different from the current one." : "Could not update the password.")
  await db.from("merchants").update({ must_change_password: false, updated_at: new Date().toISOString() }).eq("id", m.id)
  // Anyone else signed in to this account (other browsers, a thief) is signed out; this session stays.
  const { data: { session } } = await (await createClient({ readOnly: true, merchant: true })).auth.getSession()
  if (session?.access_token) await db.auth.admin.signOut(session.access_token, "others").catch(() => null)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "merchant.password_changed" })
  // Replacing the temporary password is part of onboarding, not a security event worth an email.
  if (!m.must_change_password) await sendPasswordChangedEmail({ email: m.email }).catch(() => null)
  return { success: true }
}

const otpHash = (merchantId: string, code: string) =>
  crypto.createHmac("sha256", getCheckoutEncryptionKey()).update(`merchant-email-otp:v1:${merchantId}:${code}`).digest("hex")

export async function sendMerchantEmailCodeAction(): Promise<Result> {
  const ctx = await requireMerchant("signed_in")
  if ("error" in ctx) return fail(ctx.error)
  const m = ctx.merchant
  if (m.email_verified_at) return { success: true }
  if (!(await rateLimit(`merchant-otp:${m.id}`, { windowMs: 600_000, max: 3 })).ok) return fail("Too many codes requested. Wait 10 minutes.")

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
  await merchantDb()
    .from("merchants")
    .update({ email_otp_hash: otpHash(m.id, code), email_otp_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), email_otp_attempts: 0 })
    .eq("id", m.id)
  const sent = await sendMerchantEmail({
    to: m.email,
    subject: `${code} is your Byiora merchant verification code`,
    heading: "Confirm your email",
    paragraphs: ["Enter this code in the merchant portal to confirm your email address. It expires in 10 minutes.", "If you did not try to sign in, change your password straight away."],
    box: [{ label: "Verification code", value: code }],
  }).catch(() => null)
  return sent?.data ? { success: true } : fail("Could not send the email. Try again in a minute.")
}

export async function verifyMerchantEmailCodeAction(code: string): Promise<Result> {
  const ctx = await requireMerchant("signed_in")
  if ("error" in ctx) return fail(ctx.error)
  const m = ctx.merchant
  if (m.email_verified_at) return { success: true }
  if (!/^\d{6}$/.test(String(code))) return fail("Enter the 6-digit code.")
  if (!m.email_otp_hash || !m.email_otp_expires_at || new Date(m.email_otp_expires_at) < new Date()) return fail("This code has expired. Send a new one.")
  if (m.email_otp_attempts >= 5) return fail("Too many wrong codes. Send a new one.")

  const db = merchantDb()
  const ok = crypto.timingSafeEqual(Buffer.from(otpHash(m.id, code), "hex"), Buffer.from(m.email_otp_hash, "hex"))
  if (!ok) {
    await db.from("merchants").update({ email_otp_attempts: m.email_otp_attempts + 1 }).eq("id", m.id)
    return fail("That code is wrong.")
  }
  await db.from("merchants").update({ email_verified_at: new Date().toISOString(), email_otp_hash: null, email_otp_expires_at: null, email_otp_attempts: 0 }).eq("id", m.id)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "merchant.email_verified" })
  return { success: true }
}

// ── Forgot password: a 6-digit code by email, then a new password ─────────

const resetHash = (merchantId: string, code: string) =>
  crypto.createHmac("sha256", getCheckoutEncryptionKey()).update(`merchant-reset:v1:${merchantId}:${code}`).digest("hex")
const RESET_SENT = "If that email belongs to a merchant account, we sent it a 6-digit code."

/** Always answers the same way, so it can't be used to discover which emails are merchants. */
export async function requestMerchantPasswordResetAction(email: string, captchaToken: string): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const ip = (await clientIp()) || "unknown"
  const cleanEmail = String(email || "").trim().toLowerCase().slice(0, 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return fail("Enter your email address.")
  if (!(await rateLimit(`merchant-reset-ip:${ip}`, { windowMs: 900_000, max: 5 })).ok) return fail("Too many requests. Try again in 15 minutes.")
  if (!(await verifyTurnstileToken(captchaToken, ip))) return fail("Captcha validation failed. Please retry.")
  if (!(await rateLimit(`merchant-reset-email:${cleanEmail}`, { windowMs: 3_600_000, max: 3 })).ok) return { success: true, message: RESET_SENT }

  const db = merchantDb()
  const { data: m } = await db.from("merchants").select("id, user_id, email, status").eq("email", cleanEmail).maybeSingle()
  if (!m || m.status === "banned") return { success: true, message: RESET_SENT }
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
  // Shares the email-code columns: a reset code also proves the merchant owns the inbox.
  await db.from("merchants").update({ email_otp_hash: resetHash(m.id, code), email_otp_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), email_otp_attempts: 0 }).eq("id", m.id)
  await sendMerchantEmail({
    to: m.email,
    subject: `${code} is your Byiora merchant password reset code`,
    heading: "Reset your password",
    paragraphs: ["Enter this code on the merchant sign-in page to choose a new password. It expires in 15 minutes.", "If you didn't ask for this, ignore this email. Your password stays the same."],
    box: [{ label: "Reset code", value: code }],
  }).catch(() => null)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "merchant.password_reset_requested" })
  return { success: true, message: RESET_SENT }
}

export async function resetMerchantPasswordAction(email: string, code: string, newPassword: string): Promise<Result> {
  const cleanEmail = String(email || "").trim().toLowerCase()
  const bad = "That code is wrong or has expired. Request a new one."
  if (!/^\d{6}$/.test(String(code))) return fail("Enter the 6-digit code.")
  const weak = checkPasswordStrength(newPassword)
  if (weak) return fail(weak)
  const ip = (await clientIp()) || "unknown"
  if (!(await rateLimit(`merchant-reset-try:${ip}`, { windowMs: 900_000, max: 10 })).ok) return fail("Too many attempts. Try again in 15 minutes.")

  const db = merchantDb()
  const { data: m } = await db.from("merchants").select("id, user_id, email, status, email_otp_hash, email_otp_expires_at, email_otp_attempts").eq("email", cleanEmail).maybeSingle()
  if (!m || m.status === "banned" || !m.email_otp_hash || !m.email_otp_expires_at || new Date(m.email_otp_expires_at) < new Date()) return fail(bad)
  if (m.email_otp_attempts >= 5) return fail("Too many wrong codes. Request a new one.")
  if (!crypto.timingSafeEqual(Buffer.from(resetHash(m.id, code), "hex"), Buffer.from(m.email_otp_hash, "hex"))) {
    await db.from("merchants").update({ email_otp_attempts: m.email_otp_attempts + 1 }).eq("id", m.id)
    return fail(bad)
  }

  const { error } = await db.auth.admin.updateUserById(m.user_id, { password: newPassword })
  if (error) return fail(/same|different/i.test(error.message) ? "Choose a password different from your old one." : "Could not update the password.")
  const now = new Date().toISOString()
  await db.from("merchants").update({ must_change_password: false, email_verified_at: now, email_otp_hash: null, email_otp_expires_at: null, email_otp_attempts: 0, updated_at: now }).eq("id", m.id)
  // Sign out every existing session (whoever might have had the old password); 2FA still applies at the next sign-in.
  const probe = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: s } = await probe.auth.signInWithPassword({ email: m.email, password: newPassword })
  if (s.session) await db.auth.admin.signOut(s.session.access_token, "global").catch(() => null)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "merchant.password_reset" })
  await sendPasswordChangedEmail({ email: m.email }).catch(() => null)
  return { success: true }
}

/** Called by the security page after the browser adds or removes the authenticator. */
export async function recordMerchantMfaChangeAction(enabled: boolean): Promise<void> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return
  // Trust the session's real state, not the argument, for the audit entry.
  if (ctx.mfaEnabled !== enabled) return
  await audit({ actorType: "merchant", actorId: ctx.merchant.user_id, merchantId: ctx.merchant.id, action: enabled ? "merchant.mfa_enabled" : "merchant.mfa_disabled" })
  await sendMerchantEmail({
    to: ctx.merchant.email,
    subject: enabled ? "Two-factor sign-in is on" : "Two-factor sign-in was turned off",
    heading: enabled ? "Two-factor sign-in is on" : "Two-factor sign-in was turned off",
    paragraphs: [enabled ? "Your merchant account now asks for an authenticator code at every sign-in." : "Your merchant account no longer asks for an authenticator code. If this wasn't you, change your password and contact support now."],
  }).catch(() => null)
}

// ── KYC ──────────────────────────────────────────────────────────────────

export type MyKyc = {
  version: number
  status: "pending" | "approved" | "rejected" | "more_info"
  adminNote: string | null
  legalName: string
  businessType: string
  panNumber: string
  registrationNumber: string | null
  address: string
  website: string | null
  documents: { type: string; size: number }[]
  createdAt: string
} | null

export async function getMyKycAction(): Promise<MyKyc> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const { data: r } = await merchantDb()
    .from("merchant_kyc_submissions")
    .select("version, status, admin_note, legal_name, business_type, pan_number, registration_number, address, website, documents, created_at")
    .eq("merchant_id", ctx.merchant.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!r) return null
  return {
    version: r.version,
    status: r.status,
    adminNote: r.admin_note,
    legalName: r.legal_name,
    businessType: r.business_type,
    panNumber: r.pan_number,
    registrationNumber: r.registration_number,
    address: r.address,
    website: r.website,
    documents: (r.documents || []).map((d: any) => ({ type: d.type, size: d.size })),
    createdAt: r.created_at,
  }
}

const KYC_OPEN = ["not_submitted", "more_info", "rejected"]

async function nextKycVersion(merchantId: string): Promise<number> {
  const { data } = await merchantDb().from("merchant_kyc_submissions").select("version").eq("merchant_id", merchantId).order("version", { ascending: false }).limit(1).maybeSingle()
  return (data?.version || 0) + 1
}

/** Signed one-off upload slot inside this merchant's own folder; the browser uploads straight to storage. */
export async function createKycUploadAction(docType: string, mime: string, size: number): Promise<{ success: true; path: string; token: string } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail(ctx.error)
  const m = ctx.merchant
  if (!KYC_OPEN.includes(m.kyc_status)) return fail("Your documents are already submitted.")
  if (!(docType in KYC_DOC_TYPES)) return fail("Unknown document type.")
  if (!(mime in KYC_MIME)) return fail("Upload a PDF, JPG or PNG.")
  if (!(size > 0 && size <= KYC_MAX_BYTES)) return fail("Each file must be 5 MB or smaller.")
  if (!(await rateLimit(`merchant-kyc-upload:${m.id}`, { windowMs: 3_600_000, max: 40 })).ok) return fail("Too many uploads. Try again later.")

  const path = `${m.id}/v${await nextKycVersion(m.id)}/${docType}-${crypto.randomUUID()}.${KYC_MIME[mime as keyof typeof KYC_MIME]}`
  const { data, error } = await merchantDb().storage.from("merchant-kyc").createSignedUploadUrl(path)
  if (error || !data) return fail("Could not prepare the upload.")
  return { success: true, path: data.path, token: data.token }
}

export async function submitKycAction(input: {
  legalName: string
  businessType: string
  panNumber: string
  registrationNumber?: string
  address: string
  website?: string
  documents: { type: string; path: string }[]
}): Promise<Result> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail(ctx.error)
  const m = ctx.merchant
  if (!KYC_OPEN.includes(m.kyc_status)) return fail("Your documents are already submitted.")

  const t = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)
  const legalName = t(input.legalName, 160)
  const businessType = t(input.businessType, 40)
  const panNumber = t(input.panNumber, 20)
  const registrationNumber = t(input.registrationNumber, 60)
  const address = t(input.address, 300)
  const website = t(input.website, 200)
  if (legalName.length < 2) return fail("Enter the registered business name.")
  if (!["sole_proprietorship", "partnership", "private_limited", "public_limited", "other"].includes(businessType)) return fail("Choose a business type.")
  if (!/^\d{9}$/.test(panNumber)) return fail("PAN / VAT number must be 9 digits.")
  if (address.length < 5) return fail("Enter the business address.")
  if (website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website)) return fail("Website must start with http:// or https://")

  const version = await nextKycVersion(m.id)
  const prefix = `${m.id}/v${version}/`
  const docs = Array.isArray(input.documents) ? input.documents.slice(0, 10) : []
  for (const need of REQUIRED_KYC_DOCS) if (!docs.some((d) => d.type === need)) return fail(`Upload: ${KYC_DOC_TYPES[need]}.`)

  // Check every file server-side: our folder only, real size, real type from its bytes.
  const bucket = merchantDb().storage.from("merchant-kyc")
  const checked: { type: KycDocType; path: string; mime: string; size: number }[] = []
  for (const d of docs) {
    if (!(d.type in KYC_DOC_TYPES) || typeof d.path !== "string" || !d.path.startsWith(prefix) || d.path.includes("..")) return fail("Invalid document. Please upload it again.")
    const { data: blob, error } = await bucket.download(d.path)
    if (error || !blob) return fail("A document is missing. Please upload it again.")
    const mime = sniffMime(new Uint8Array(await blob.slice(0, 8).arrayBuffer()))
    if (!mime || blob.size > KYC_MAX_BYTES) {
      await bucket.remove([d.path])
      return fail(`${KYC_DOC_TYPES[d.type as KycDocType]} is not a valid PDF, JPG or PNG under 5 MB.`)
    }
    checked.push({ type: d.type as KycDocType, path: d.path, mime, size: blob.size })
  }

  const db = merchantDb()
  const { error } = await db.from("merchant_kyc_submissions").insert({
    merchant_id: m.id,
    version,
    legal_name: legalName,
    business_type: businessType,
    pan_number: panNumber,
    registration_number: registrationNumber || null,
    address,
    website: website || null,
    documents: checked,
  })
  // Unique (merchant_id, version) stops a double submit.
  if (error) return fail(error.code === "23505" ? "Your documents are already submitted." : "Could not save your submission.")
  await db.from("merchants").update({ kyc_status: "submitted", updated_at: new Date().toISOString() }).eq("id", m.id)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "kyc.submitted", details: { version, documents: checked.length } })
  return { success: true }
}
