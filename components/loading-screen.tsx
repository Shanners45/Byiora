"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

interface LoadingScreenProps {
  onComplete?: () => void
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(15)

    let animationId: number
    let lastTime = performance.now()

    const animate = (time: number) => {
      const deltaTime = time - lastTime
      lastTime = time

      setProgress((prev) => {
        // Fast at start, exponentially slower as approaching 95
        const speed = prev < 30 ? 0.25 : prev < 60 ? 0.15 : prev < 85 ? 0.06 : 0.02
        const increment = speed * deltaTime
        const newProgress = Math.min(prev + increment, 95) // cap at 95 until forced complete

        animationId = requestAnimationFrame(animate)
        return newProgress
      })
    }

    animationId = requestAnimationFrame(animate)

    // Force complete after 5 seconds max
    const timeoutId = setTimeout(() => {
      cancelAnimationFrame(animationId)
      setProgress(100)
      setTimeout(() => onComplete?.(), 300)
    }, 5000)

    return () => {
      cancelAnimationFrame(animationId)
      clearTimeout(timeoutId)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1525]">
      <div className="text-center">
        {/* Gift Box Icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 relative">
            <Image
              src="/icon.png"
              alt="Loading"
              width={80}
              height={80}
              className="object-contain animate-pulse"
              priority
            />
          </div>
        </div>

        {/* Smooth Progress Bar */}
        <div className="w-64 h-2 bg-white/10 rounded-full mb-6 mx-auto overflow-hidden relative">
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #00BCD4, #4ECDC4, #00BCD4)',
              backgroundSize: '200% 100%',
              transition: 'width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              boxShadow: '0 0 20px rgba(78, 205, 196, 0.9), 0 0 8px rgba(0, 188, 212, 0.6)',
              animation: 'gradientShift 1.5s linear infinite',
            }}
          />
        </div>
        <style>{`
          @keyframes gradientShift {
            0% { background-position: 0% 0%; }
            100% { background-position: 200% 0%; }
          }
        `}</style>

        {/* Loading Text */}
        <p className="text-brand-sky-blue text-sm font-medium uppercase tracking-widest drop-shadow-md">
          {progress >= 100 ? "Ready..." : "Loading..."}
        </p>
      </div>
    </div>
  )
}
