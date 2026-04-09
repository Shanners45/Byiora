"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminRoot() {
  const router = useRouter()

  useEffect(() => {
    // Always redirect to admin login
    router.replace("/admin/login")
  }, [router])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to admin login...</p>
      </div>
    </div>
  )
}
