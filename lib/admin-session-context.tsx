"use client"

import { createContext, useContext } from "react"
import type { AdminSession } from "@/app/actions/admin-utils"

// The dashboard layout verifies the admin once and shares it, so pages don't
// each make another server round-trip (and burn rate-limit budget) per click.
const AdminSessionContext = createContext<AdminSession | null>(null)

export const AdminSessionProvider = AdminSessionContext.Provider

export function useAdminSession(): AdminSession | null {
  return useContext(AdminSessionContext)
}
