"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

interface LoadingOverlayProps {
  isLoading: boolean
}

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const [delayedLoading, setDelayedLoading] = useState(false)

  // Only show loading overlay after a short delay to avoid flashing
  useEffect(() => {
    let delayTimer: NodeJS.Timeout

    if (isLoading) {
      delayTimer = setTimeout(() => {
        setDelayedLoading(true)
        setVisible(true)
      }, 300) // Show after 300ms delay
    } else {
      setDelayedLoading(false)
      // Keep visible briefly for animation
      setTimeout(() => setVisible(false), 200)
    }

    return () => clearTimeout(delayTimer)
  }, [isLoading])

  // Handle progress animation
  useEffect(() => {
    if (!delayedLoading) {
      setProgress(0)
      return
    }

    // Start with some progress already
    setProgress(15)

    // Use requestAnimationFrame for smoother animation
    let animationId: number
    let lastTime = performance.now()

    const animate = (time: number) => {
      const deltaTime = time - lastTime
      lastTime = time

      // Adjust speed based on progress - faster at start, slower near end
      const increment = progress < 70 ? 0.15 * deltaTime : 0.05 * deltaTime

      setProgress((prev) => {
        if (!delayedLoading) return prev

        const newProgress = Math.min(prev + increment, 95) // Cap at 95% until actually loaded
        animationId = requestAnimationFrame(animate)
        return newProgress
      })
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [delayedLoading, progress])

  // Complete progress when loading finishes
  useEffect(() => {
    if (!isLoading && progress > 0) {
      setProgress(100)
    }
  }, [isLoading, progress])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300"
      style={{ opacity: delayedLoading ? 1 : 0 }}
    >
      {/* Blurred background */}
      <div className="absolute inset-0 backdrop-blur-sm bg-[#0a1525]/70" />

      {/* Loading content */}
      <div className="relative text-center bg-[#0a1525]/90 rounded-xl p-8 border border-[#4ecdc4]/20 shadow-lg shadow-[#4ecdc4]/10">
        {/* Gift Box Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 relative">
            <Image
              src="/icon.png"
              alt="Loading"
              width={64}
              height={64}
              className="object-contain animate-pulse"
              priority
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-48 h-2 bg-gray-700 rounded-full mb-6 mx-auto overflow-hidden">
          <div
            className="h-full bg-[#4ecdc4] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading Text */}
        <p className="text-white text-lg font-medium">Loading...</p>
      </div>
    </div>
  )
}
