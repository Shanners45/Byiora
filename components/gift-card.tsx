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
      className="relative aspect-[4/5] bg-[#2D1B36] rounded-3xl cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl group overflow-hidden border border-white/5 flex flex-col"
      onClick={() => {
        onClick?.()
      }}
    >
      {/* Product Image Section (Edge-to-Edge) */}
      <div className="relative w-full flex-1 overflow-hidden group-hover:scale-105 transition-transform duration-700 ease-out bg-gray-800">
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
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {logo}
          </div>
        )}
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

      {/* Info Section with Jagged SVG exactly on top */}
      <div className="relative bg-[#2D1B36] w-full z-10 pt-4 pb-5 px-3 min-h-[90px] flex flex-col justify-center">
        {/* Jagged Edge SVG placed strictly above the info section to cut into the image */}
        <div className="absolute left-0 right-0 w-full pointer-events-none" style={{ top: '-10px' }}>
          <svg 
            viewBox="0 0 100 10" 
            preserveAspectRatio="none" 
            className="w-full h-[10px] block"
          >
            <path 
              d="M0,10 L5,0 L10,10 L15,0 L20,10 L25,0 L30,10 L35,0 L40,10 L45,0 L50,10 L55,0 L60,10 L65,0 L70,10 L75,0 L80,10 L85,0 L90,10 L95,0 L100,10 V10 H0 Z" 
              fill="#2D1B36"
            />
          </svg>
        </div>

        <h3 className="font-bold text-white text-center text-sm md:text-base leading-tight line-clamp-2 w-full mx-auto relative z-10 group-hover:text-purple-300 transition-colors">
          {name}
        </h3>
        
        {/* Subtle glow on hover */}
        <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/5 transition-colors duration-300 pointer-events-none"></div>
      </div>
    </div>
  )
}
