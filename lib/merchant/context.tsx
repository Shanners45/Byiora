"use client"

import { createContext, useContext } from "react"
import type { getMerchantStateAction } from "@/app/actions/merchant"

export type MerchantState = NonNullable<Awaited<ReturnType<typeof getMerchantStateAction>>>

export const MerchantStateContext = createContext<{ state: MerchantState; refresh: () => Promise<void>; tick: number } | null>(null)

/** Only used under the merchant dashboard layout, which renders after the state loads. */
export function useMerchantState() {
  const ctx = useContext(MerchantStateContext)
  if (!ctx) throw new Error("useMerchantState must be used inside the merchant dashboard")
  return ctx
}
