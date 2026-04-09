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
      className="relative aspect-[4/5] bg-gray-900 rounded-3xl cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl group overflow-hidden border border-white/5"
      onClick={() => {
        onClick?.()
      }}
    >
      {/* Product Image Section */}
      <div className="absolute inset-0 w-full h-[110%] group-hover:scale-110 transition-transform duration-700 ease-out">
        {isImageLogo ? (
          <Image
            src={logo || "/placeholder.svg"}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-6xl">
            {logo}
          </div>
        )}
        
        {/* Subtle overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
      </div>

      {ribbon_text ? (
        <div className="absolute top-2 left-2 bg-gradient-to-r from-[#FF6B93] to-[#8B5CF6] text-white text-[10px] font-bold px-2 py-1 rounded shadow z-10 uppercase tracking-wide">
          {ribbon_text}
        </div>
      ) : isNew ? (
        <div className="absolute top-2 left-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded transform -rotate-12 z-10">
          NEW
        </div>
      ) : null}

      {/* Info Section with Jagged Edge */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Jagged Edge SVG - Positioned to overlap the image */}
        <div className="absolute top-0 left-0 w-full transform -translate-y-[98%] pointer-events-none">
          <svg 
            viewBox="0 0 100 20" 
            preserveAspectRatio="none" 
            className="w-full h-8 block"
            style={{ filter: "drop-shadow(0 -5px 10px rgba(0,0,0,0.3))" }}
          >
            <path 
              d="M0,20 L5,12 L10,18 L15,8 L22,16 L30,4 L38,15 L45,6 L52,18 L60,8 L68,16 L75,4 L82,15 L90,8 L95,16 L100,8 V20 H0 Z" 
              fill="#2D1B36"
            />
          </svg>
        </div>

        {/* Content Box */}
        <div className="bg-[#2D1B36] px-4 pb-6 pt-1 text-center min-h-[85px] flex flex-col justify-center items-center">
          <h3 className="font-bold text-white text-sm md:text-base leading-tight line-clamp-2 max-w-[90%] group-hover:text-purple-300 transition-colors drop-shadow-sm">
            {name}
          </h3>
          
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/5 transition-colors duration-300 pointer-events-none"></div>
        </div>
      </div>
    </div>
  )
}
