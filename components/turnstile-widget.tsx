"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          "expired-callback"?: () => void
          "error-callback"?: () => void
          theme?: "light" | "dark" | "auto"
        },
      ) => string
      reset: (widgetId?: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void
}

export function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const renderWidget = () => {
    if (typeof window !== "undefined" && window.turnstile && ref.current && siteKey) {
      // Clear container before rendering to avoid duplicate widgets on re-mount
      ref.current.innerHTML = ""
      window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
        theme: "auto",
      })
    }
  }

  // Handle re-mounts if the script is already loaded
  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile) {
      renderWidget()
    }
  }, [siteKey])

  if (!siteKey) return null

  return (
    <div className="w-full min-h-[65px] flex justify-center items-center overflow-hidden">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onLoad={renderWidget}
      />
      <div
        ref={ref}
        className="transform scale-[0.85] origin-center sm:scale-100 transition-transform duration-200"
      />
    </div>
  )
}
