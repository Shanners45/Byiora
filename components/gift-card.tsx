"use client"

import Image from "next/image"

interface GiftCardProps {
  id: string
  name: string
  logo: string
  category?: string
  slug?: string
  isNew?: boolean
  ribbon_text?: string
  denominations?: Array<any>
  onClick?: () => void
}

export function GiftCard({ id, name, logo, category, slug, isNew, ribbon_text, onClick }: GiftCardProps) {
  const isImageLogo = logo.startsWith("http") || logo.startsWith("/")

  return (
    <div
      className="relative bg-gray-800 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group overflow-hidden"
      onClick={() => {
        onClick?.()
      }}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Custom ribbon badge (takes priority) */}
      {ribbon_text ? (
        <div className="absolute top-2 left-2 bg-gradient-to-r from-[#FF6B93] to-[#8B5CF6] text-white text-[10px] font-bold px-2 py-1 rounded shadow z-10 uppercase tracking-wide">
          {ribbon_text}
        </div>
      ) : isNew ? (
        <div className="absolute top-2 left-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded transform -rotate-12 z-10">
          NEW
        </div>
      ) : null}

      {/* Icon container */}
      <div className="relative aspect-square bg-gray-700 rounded-lg flex items-center justify-center mb-3 group-hover:bg-gray-600 transition-colors overflow-hidden">
        {isImageLogo ? (
          <div className="w-full h-full relative group-hover:scale-110 transition-transform duration-300">
            <Image
              src={logo || "/placeholder.svg"}
              alt={name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          </div>
        ) : (
          <div className="text-4xl md:text-5xl group-hover:scale-110 transition-transform duration-300">{logo}</div>
        )}
      </div>

      {/* Title */}
      <div className="relative z-10">
        <h3 className="font-semibold text-white text-sm md:text-base text-center group-hover:text-yellow-300 transition-colors">
          {name}
        </h3>
      </div>
    </div>
  )
}
