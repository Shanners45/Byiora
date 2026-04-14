"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface Banner {
  id: string
  image_url: string
  link_url: string
  title: string
}

interface BannerCarouselProps {
  /** Pre-fetched banners from the server. If provided, skips client-side fetch. */
  initialBanners?: Banner[]
}

export function BannerCarousel({ initialBanners }: BannerCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [banners, setBanners] = useState<Banner[]>(initialBanners || [])

  // Only self-fetch if no initialBanners were provided (backward compatibility)
  useEffect(() => {
    if (initialBanners && initialBanners.length > 0) return

    const fetchBanners = async () => {
      try {
        const { supabase } = await import("@/lib/supabase")
        const { data, error } = await supabase
          .from("banners")
          .select("id, image_url, link_url, title")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })

        if (!error && data && data.length > 0) {
          setBanners(data)
        } else {
          setBanners([
            { id: "1", image_url: "/images/banner-1.jpeg", link_url: "", title: "Banner 1" },
            { id: "2", image_url: "/images/banner-2.png", link_url: "", title: "Banner 2" },
            { id: "3", image_url: "/images/banner-3.png", link_url: "", title: "Banner 3" },
          ])
        }
      } catch {
        setBanners([
          { id: "1", image_url: "/images/banner-1.jpeg", link_url: "", title: "Banner 1" },
          { id: "2", image_url: "/images/banner-2.png", link_url: "", title: "Banner 2" },
          { id: "3", image_url: "/images/banner-3.png", link_url: "", title: "Banner 3" },
        ])
      }
    }

    fetchBanners()
  }, [initialBanners])

  // Auto-rotate slides
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [banners.length])

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)

  if (banners.length === 0) {
    return <div className="relative w-full h-80 md:h-96 rounded-2xl overflow-hidden bg-gray-200 animate-pulse" />
  }

  return (
    <div className="relative w-full h-[340px] md:h-[420px] rounded-2xl overflow-hidden group">
      <div className="relative h-full">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-transform duration-500 ease-in-out ${
              index === currentSlide ? "translate-x-0" : index < currentSlide ? "-translate-x-full" : "translate-x-full"
            }`}
          >
            {banner.link_url ? (
              <a href={banner.link_url} className="block relative h-full w-full">
                <Image
                  src={banner.image_url}
                  alt={banner.title || `Banner ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1200px"
                  priority={index === 0}
                />
              </a>
            ) : (
              <div className="relative h-full w-full">
                <Image
                  src={banner.image_url}
                  alt={banner.title || `Banner ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1200px"
                  priority={index === 0}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      {banners.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide ? "bg-white w-8" : "bg-white/50 w-2"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
