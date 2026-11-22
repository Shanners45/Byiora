"use server"

import crypto from "crypto"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getCheckoutEncryptionKey } from "@/lib/crypto/checkout"

/**
 * Shared utility to verify the current user is an admin.
 * Used across multiple server actions to prevent duplicate code.
 */
export type AdminSession = {
  id: string
  name: string
  email: string
  role: "admin" | "sub_admin" | "order_management"
  status: "active" | "blocked"
}

// Two-factor login for every admin action. Emergency switch: set
// ADMIN_MFA_REQUIRED=false in the environment (e.g. lost phone) and redeploy.
const ADMIN_MFA_REQUIRED = process.env.ADMIN_MFA_REQUIRED !== "false"

type AdminSessionResult = { success: true; data: AdminSession } | { success: false; error: string }

const TRUST_COOKIE = "byiora_admin_trust"
const TRUST_DAYS = 7

// Signed "trusted device" token: bound to the admin, their current authenticator
// (removing it revokes trust) and an expiry. The key is domain-separated by label.
function signTrust(userId: string, factorId: string, exp: number) {
  return crypto.createHmac("sha256", getCheckoutEncryptionKey()).update(`admin-trusted-device:v1:${userId}:${factorId}:${exp}`).digest("hex")
}

/** aal2 session, or a valid trusted-device cookie for this admin's verified authenticator. */
async function isMfaSatisfied(): Promise<boolean> {
  const supabase = await createClient({ readOnly: true })
  const { data: { session } } = await supabase.auth.getSession()
  const { data: aal } = session?.access_token
    ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
    : { data: null }
  if (aal?.currentLevel === "aal2") return true

  const [exp, sig] = ((await cookies()).get(TRUST_COOKIE)?.value || "").split(".")
  if (!exp || !sig || !(Number(exp) > Date.now())) return false
  const { data: { user } } = await supabase.auth.getUser()
  const factorId = user?.factors?.find((f) => f.factor_type === "totp" && f.status === "verified")?.id
  if (!user || !factorId) return false
  const expected = Buffer.from(signTrust(user.id, factorId, Number(exp)), "hex")
  const provided = Buffer.from(sig, "hex")
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
}

/** Session admin with every admin action gated on 2FA (or a trusted device). */
export async function getAdminSessionAction(): Promise<AdminSessionResult> {
  const result = await loadAdminSession()
  if (!result.success || !ADMIN_MFA_REQUIRED) return result
  if (!(await isMfaSatisfied())) return { success: false, error: "MFA_REQUIRED" }
  return result
}

/** After a successful 2FA code: remember this browser for TRUST_DAYS. */
export async function trustAdminDeviceAction(): Promise<{ success: boolean }> {
  const supabase = await createClient({ readOnly: true })
  const { data: { session } } = await supabase.auth.getSession()
  const { data: aal } = session?.access_token
    ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
    : { data: null }
  // Only a fresh code login may mint trust, never an already-trusted session.
  if (aal?.currentLevel !== "aal2" || !(await loadAdminSession()).success) return { success: false }
  const { data: { user } } = await supabase.auth.getUser()
  const factorId = user?.factors?.find((f) => f.factor_type === "totp" && f.status === "verified")?.id
  if (!user || !factorId) return { success: false }
  const exp = Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000
  ;(await cookies()).set(TRUST_COOKIE, `${exp}.${signTrust(user.id, factorId, exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TRUST_DAYS * 24 * 60 * 60,
  })
  return { success: true }
}

/**
 * Which 2FA step the signed-in admin still needs. Reveals nothing to non-admins
 * ("none"), so the login page can safely call it on load.
 */
export async function getAdminMfaStageAction(): Promise<{ stage: "none" | "enroll" | "verify" | "done" }> {
  const result = await loadAdminSession()
  if (!result.success) return { stage: "none" }
  if (!ADMIN_MFA_REQUIRED || (await isMfaSatisfied())) return { stage: "done" }
  const supabase = await createClient({ readOnly: true })
  const { data: { session } } = await supabase.auth.getSession()
  const { data: aal } = session?.access_token
    ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
    : { data: null }
  return { stage: aal?.nextLevel === "aal2" ? "verify" : "enroll" }
}

// Not exported: password-only admin check, used before 2FA is complete.
async function loadAdminSession(): Promise<AdminSessionResult> {
  try {
    const supabase = await createClient({ readOnly: true })
    const { data, error: userError } = await supabase.auth.getUser()
    if (userError || !data?.user) return { success: false, error: "Unauthorized" }
    const user = data.user
    
    // Use Service Role to bypass RLS for verification
    // This is safe because we are searching by the verified user.id from auth.getUser()
    const serviceSupabase = createServiceRoleClient()
    const { data: adminUser, error } = await serviceSupabase
      .from('admin_users')
      .select('id, name, email, role, status')
      .eq('id', user.id)
      .single()
    
    if (error || !adminUser) return { success: false, error: "Forbidden" }
    if (adminUser.status !== "active") return { success: false, error: "Blocked" }

    return { success: true, data: adminUser as AdminSession }
  } catch (err) {
    return { success: false, error: "Unauthorized" }
  }
}

export async function verifyAdmin(): Promise<boolean> {
  const result = await getAdminSessionAction()
  return result.success
}

/**
 * Strict check: Only full Super Admins (role === "admin")
 * Use for user management, role promotion, password resets, and bank credentials.
 */
export async function verifySuperAdmin(): Promise<boolean> {
  const result = await getAdminSessionAction()
  return result.success && result.data.role === "admin"
}

/**
 * Allows the signed-in admin to update ONLY their own display name.
 * Role/status changes remain super-admin-only via admin-users.ts.
 */
export async function updateOwnAdminNameAction(name: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  const cleanName = name?.trim()
  if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
    return { success: false, error: "Name must be between 2 and 80 characters." }
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from("admin_users")
    .update({ name: cleanName, updated_at: new Date().toISOString() })
    .eq("id", session.data.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

