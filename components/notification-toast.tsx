"use client"

import { X, Bell } from "lucide-react"
import { useEffect, useState } from "react"

interface NotificationToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationToast({ open, onOpenChange }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`bg-white rounded-lg shadow-lg border border-gray-200 w-80 transition-all duration-300 ${
          open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-brand-charcoal">Notifications</h2>
            <button onClick={() => onOpenChange(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Bell className="h-12 w-12 text-gray-300" />
            </div>
            <p className="text-brand-light-gray text-base">No notifications yet</p>
          </div>
        </div>
      </div>
    </div>
  )
}
