"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { X, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"

interface Announcement {
  id: string
  title: string
  message: string
  type: "banner" | "modal"
  theme: string
  link_url?: string
  link_text?: string
  is_active: boolean
}

// Removed mock data
//   title: "Store Maintenance",
//   message: "We are currently upgrading our payment gateways. Top-ups may be delayed by up to 10 minutes.",
//   type: "modal" as const,
//   theme: "critical",
//   link_url: "",
//   link_text: "",
//   is_active: true,
// }

export function GlobalAnnouncement() {
  const [isVisible, setIsVisible] = useState(false)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const fetchAnnouncement = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("store_announcements")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single()

      if (data && !error) {
        // Check localStorage to see if user previously dismissed it
        const dismissedStr = localStorage.getItem("dismissed_announcements")
        if (dismissedStr) {
          try {
            const dismissed = JSON.parse(dismissedStr)
            const dismissedTime = dismissed[(data as any).id]
            
            if (dismissedTime) {
              const now = Date.now()
              const hoursPassed = (now - dismissedTime) / (1000 * 60 * 60)
              
              // Banners reappear after 24 hours. Modals reappear after 1 hour.
              const expiryHours = (data as any).type === 'modal' ? 1 : 24
              
              if (hoursPassed < expiryHours) {
                return // Still in cooldown period, don't show
              }
            }
          } catch (e) {
            // Error parsing localStorage, just ignore and show
          }
        }
        
        setAnnouncement(data as any)
        setIsVisible(true)
      }
    }

    fetchAnnouncement()
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    if (announcement) {
      try {
        const dismissedStr = localStorage.getItem("dismissed_announcements")
        const dismissed = dismissedStr ? JSON.parse(dismissedStr) : {}
        dismissed[announcement.id] = Date.now()
        localStorage.setItem("dismissed_announcements", JSON.stringify(dismissed))
      } catch (e) {
        console.error("Failed to save dismissal state")
      }
    }
  }

  // Do not show on admin pages
  if (pathname?.startsWith("/admin")) return null
  if (!isVisible || !announcement) return null

  // --- MODAL RENDER ---
  if (announcement.type === "modal") {
    const isCritical = announcement.theme === "critical";
    const titleColor = isCritical ? "text-red-500" : "text-brand-purple";
    const btnBg = isCritical ? "bg-red-500 hover:bg-red-600 text-white" : "bg-brand-purple hover:bg-brand-purple/90 text-white";

    return (
      <Dialog open={isVisible} onOpenChange={(open) => {
        if (!open) handleDismiss()
      }}>
        <DialogContent className="w-[90vw] sm:max-w-[480px] bg-white border-0 shadow-2xl p-0 overflow-hidden rounded-2xl [&>button]:hidden">
          <div className="p-4 sm:p-8">
            <DialogHeader className="space-y-3 sm:space-y-4">
              <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-brand-soft-white mb-1 sm:mb-2">
                <AlertCircle className={`w-6 h-6 sm:w-8 sm:h-8 ${titleColor}`} />
              </div>
              <DialogTitle className="text-center text-xl sm:text-2xl font-bold text-brand-charcoal">
                {announcement.title}
              </DialogTitle>
              <DialogDescription className="text-center pt-1 sm:pt-2 text-sm sm:text-[15px] leading-relaxed text-brand-light-gray px-2">
                {announcement.message}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 sm:mt-8 flex justify-center">
              <button
                onClick={handleDismiss}
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 rounded-full font-bold text-sm transition-transform hover:scale-105 active:scale-95 shadow-md ${btnBg}`}
              >
                I Understand
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // --- BANNER RENDER ---
  const themeClasses = {
    info: "bg-brand-sky-blue text-white",
    sale: "bg-hero-gradient text-brand-charcoal",
    critical: "bg-red-500 text-white",
  }
  const bgClass = themeClasses[announcement.theme as keyof typeof themeClasses] || themeClasses.info

  return (
    <div className={`relative w-full py-2.5 sm:py-3 px-3 sm:px-6 lg:px-8 flex items-center justify-center shadow-md ${bgClass}`}>
      <div className="flex flex-col sm:flex-row items-center gap-x-3 gap-y-1 text-center pr-6 sm:pr-0">
        <span className="font-bold text-[13px] sm:text-base tracking-wide flex items-center gap-1.5 sm:gap-2">
          {announcement.theme === 'sale' ? '🎉' : <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          {announcement.title}
        </span>
        <span className="hidden sm:inline opacity-60 font-light">|</span>
        <span className="text-[12px] sm:text-base font-medium opacity-90">{announcement.message}</span>

        {announcement.link_url && (
          <a
            href={announcement.link_url}
            className={`mt-1 sm:mt-0 inline-flex items-center justify-center rounded-full px-4 sm:px-5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-transform hover:scale-105 active:scale-95 shadow-sm
              ${announcement.theme === 'sale'
                ? 'bg-brand-charcoal text-brand-soft-yellow'
                : 'bg-white text-brand-charcoal'}`}
          >
            {announcement.link_text || "Learn More"}
          </a>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="absolute right-1 sm:right-6 p-2 rounded-full hover:bg-black/10 transition-colors focus:outline-none"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 opacity-70 hover:opacity-100" />
      </button>
    </div>
  )
}
