"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

type OverlayType = "success" | "cancelled" | "failed"

interface CheckoutOverlayProps {
  type: OverlayType
  onComplete?: () => void
  /** Delay in ms before calling onComplete. Default 2800ms. */
  delayMs?: number
}

// Animation configs per type
const OVERLAY_CONFIG: Record<OverlayType, {
  title: string
  subtitle: string
  accentColor: string
  bgGradient: string
  ringColor: string
}> = {
  success: {
    title: "Payment Successful",
    subtitle: "Redirecting you shortly…",
    accentColor: "#10b981",
    bgGradient: "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.08) 0%, transparent 70%)",
    ringColor: "rgba(16, 185, 129, 0.15)",
  },
  cancelled: {
    title: "Order Cancelled",
    subtitle: "Redirecting you shortly…",
    accentColor: "#7E3AF2",
    bgGradient: "radial-gradient(ellipse at center, rgba(126, 58, 242, 0.08) 0%, transparent 70%)",
    ringColor: "rgba(126, 58, 242, 0.15)",
  },
  failed: {
    title: "Payment Failed",
    subtitle: "Your session has expired",
    accentColor: "#ef4444",
    bgGradient: "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.08) 0%, transparent 70%)",
    ringColor: "rgba(239, 68, 68, 0.15)",
  },
}

export default function CheckoutOverlay({ type, onComplete, delayMs = 2800 }: CheckoutOverlayProps) {
  const [animData, setAnimData] = useState<any>(null)
  const [showText, setShowText] = useState(false)
  const config = OVERLAY_CONFIG[type]

  // Load lottie data
  useEffect(() => {
    if (type === "success") {
      fetch("/animations/payment-success.json")
        .then(r => r.json())
        .then(setAnimData)
        .catch(() => {})
    } else if (type === "failed" || type === "cancelled") {
      fetch("/animations/payment-failed.json")
        .then(r => r.json())
        .then(setAnimData)
        .catch(() => {})
    }
  }, [type])

  // Show text slightly after mount
  useEffect(() => {
    const t = setTimeout(() => setShowText(true), 400)
    return () => clearTimeout(t)
  }, [])

  // Trigger redirect after delay
  useEffect(() => {
    if (!onComplete) return
    const t = setTimeout(onComplete, delayMs)
    return () => clearTimeout(t)
  }, [onComplete, delayMs])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        animation: "overlayFadeIn 0.4s ease-out",
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: config.bgGradient }}
      />

      {/* Pulsing rings behind the icon */}
      <div className="relative flex items-center justify-center mb-6">
        <div
          className="absolute rounded-full"
          style={{
            width: 200,
            height: 200,
            background: config.ringColor,
            animation: "pulseRing 2s ease-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 160,
            height: 160,
            background: config.ringColor,
            animation: "pulseRing 2s ease-out 0.4s infinite",
          }}
        />

        {/* Icon/Animation */}
        <div className="relative z-10" style={{ width: 120, height: 120 }}>
          {(type === "success" || type === "failed") && animData ? (
            <Lottie
              animationData={animData}
              loop={false}
              style={{ width: 120, height: 120, transform: "scale(2.2)" }}
            />
          ) : type === "cancelled" ? (
            <CancelledIcon color={config.accentColor} />
          ) : (
            <FailedIcon color={config.accentColor} />
          )}
        </div>
      </div>

      {/* Text */}
      <div
        className="text-center relative z-10"
        style={{
          opacity: showText ? 1 : 0,
          transform: showText ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-2"
          style={{ color: "#1f2937" }}
        >
          {config.title}
        </h2>
        <p className="text-gray-400 text-base">{config.subtitle}</p>
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-1 rounded-r-full"
        style={{
          background: config.accentColor,
          animation: `progressBar ${delayMs}ms linear forwards`,
        }}
      />

      <style jsx>{`
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  )
}

// SVG icon for Cancelled state — animated circle + X
function CancelledIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120">
      <circle
        cx="60" cy="60" r="50"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="314"
        strokeDashoffset="314"
        style={{ animation: "drawCircle 0.6s ease-out 0.2s forwards" }}
      />
      <line
        x1="42" y1="42" x2="78" y2="78"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="51"
        strokeDashoffset="51"
        style={{ animation: "drawLine 0.3s ease-out 0.7s forwards" }}
      />
      <line
        x1="78" y1="42" x2="42" y2="78"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="51"
        strokeDashoffset="51"
        style={{ animation: "drawLine 0.3s ease-out 0.85s forwards" }}
      />
      <style>{`
        @keyframes drawCircle {
          to { stroke-dashoffset: 0; }
        }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  )
}

function FailedIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120">
      <circle
        cx="60" cy="60" r="50"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="314"
        strokeDashoffset="314"
        style={{ animation: "drawCircle 0.5s cubic-bezier(0.65, 0, 0.45, 1) 0.2s forwards" }}
      />
      <line
        x1="40" y1="40" x2="80" y2="80"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="57"
        strokeDashoffset="57"
        style={{ animation: "drawLine 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards" }}
      />
      <line
        x1="80" y1="40" x2="40" y2="80"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="57"
        strokeDashoffset="57"
        style={{ animation: "drawLine 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards" }}
      />
      <style>{`
        @keyframes drawCircle {
          to { stroke-dashoffset: 0; }
        }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  )
}
