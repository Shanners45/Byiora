"use client"

import { useEffect, useRef, useState } from "react"

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
  const [widgetId, setWidgetId] = useState<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !ref.current) return

    const scriptId = "cf-turnstile-script"
    const onReady = () => {
      if (!window.turnstile || !ref.current) return
      const id = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
        theme: "auto",
      })
      setWidgetId(id)
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script")
      script.id = scriptId
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      script.async = true
      script.defer = true
      script.onload = onReady
      document.head.appendChild(script)
    } else {
      onReady()
    }
  }, [onToken, siteKey])

  if (!siteKey) return null

  return (
    <div className="w-full min-h-[65px] flex justify-center items-center overflow-hidden">
      <div 
        ref={ref} 
        className="transform scale-[0.85] origin-center sm:scale-100 transition-transform duration-200"
      />
    </div>
  )
}

