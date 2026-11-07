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
  isOutOfStock?: boolean
  denominations?: Array<any>
  onClick?: () => void
}

export function GiftCard({ id, name, logo, category, slug, isNew, ribbon_text, isOutOfStock, onClick }: GiftCardProps) {
  const isImageLogo = logo.startsWith("http") || logo.startsWith("/")

  return (
    <div
      className="relative bg-gray-800 rounded-xl p-2 sm:p-3 md:p-4 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group overflow-hidden flex flex-col justify-between"
      onClick={() => {
        onClick?.()
      }}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#4DA8DA]/20 to-[#80D8C3]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Custom ribbon badge (takes priority) */}
      {isOutOfStock ? (
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 max-w-[calc(100%-12px)] sm:max-w-[calc(100%-16px)] bg-gray-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow z-10 uppercase tracking-wide truncate">
          OUT OF STOCK
        </div>
      ) : ribbon_text ? (
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 max-w-[calc(100%-12px)] sm:max-w-[calc(100%-16px)] bg-gradient-to-r from-[#FF6B93] to-[#8B5CF6] text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow z-10 uppercase tracking-wide truncate">
          {ribbon_text}
        </div>
      ) : isNew ? (
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-yellow-400 text-black text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transform -rotate-12 z-10">
          NEW
        </div>
      ) : null}

      {/* Icon container */}
      <div className="relative aspect-square bg-gray-700 rounded-lg flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-gray-600 transition-colors overflow-hidden">
        {isImageLogo ? (
          <div className="w-full h-full relative group-hover:scale-110 transition-transform duration-300">
            <Image
              src={logo || "/placeholder.svg"}
              alt={name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
            />
          </div>
        ) : (
          <div className="text-3xl sm:text-4xl md:text-5xl group-hover:scale-110 transition-transform duration-300">{logo}</div>
        )}
      </div>

      {/* Title */}
      <div className="relative z-10 flex-1 flex items-center justify-center min-h-[2rem] sm:min-h-[2.5rem]">
        <h3 className="font-semibold text-white text-[11px] sm:text-xs md:text-sm lg:text-base text-center group-hover:text-yellow-300 transition-colors leading-tight line-clamp-3 break-words">
          {name}
        </h3>
      </div>
    </div>
  )
}
