"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Toaster } from "sonner"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // No client-side auth redirection needed here anymore, edge middleware protects /admin/dashboard routes.
  // /admin/login handles its own logic.

  return (
    <div className="min-h-screen bg-gray-100">
      {children}
      <Toaster position="top-right" richColors />
    </div>
  )
}
