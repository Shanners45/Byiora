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
      <div 
        className="absolute top-0 left-0 w-full h-[78%] group-hover:scale-105 transition-transform duration-700 ease-out overflow-hidden"
        style={{ 
          clipPath: "polygon(0 0, 100% 0, 100% 96%, 95% 100%, 90% 96%, 85% 100%, 80% 96%, 75% 100%, 70% 96%, 65% 100%, 60% 96%, 55% 100%, 50% 96%, 45% 100%, 40% 96%, 35% 100%, 30% 96%, 25% 100%, 20% 96%, 15% 100%, 10% 96%, 5% 100%, 0 96%)" 
        }}
      >
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
        
        {/* Subtle overlay to help text legibility if needed, though most text is below now */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-40"></div>
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

      {/* Info Section - Now meeting the clipped image */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-[#2D1B36] flex flex-col justify-center items-center py-5 min-h-[30%] px-4 text-center">
        <h3 className="font-bold text-white text-sm md:text-base leading-tight line-clamp-2 max-w-[95%] group-hover:text-purple-300 transition-colors">
          {name}
        </h3>
        
        {/* Subtle glow on hover */}
        <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/5 transition-colors duration-300 pointer-events-none"></div>
      </div>
    </div>
  )
}
