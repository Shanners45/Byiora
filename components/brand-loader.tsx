import Image from "next/image"

/** Full-screen Byiora logo loader, used while the admin session is being checked. */
export function BrandLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/logo-final.png"
          alt="Byiora"
          width={160}
          height={56}
          priority
          className="animate-pulse"
          style={{ objectFit: "contain", width: "auto", height: 56 }}
        />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-1/2 rounded-full bg-[#7E3AF2] animate-[brandload_1s_ease-in-out_infinite]" />
        </div>
        <span className="sr-only">{label || "Loading"}</span>
      </div>
      <style>{`@keyframes brandload { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }`}</style>
    </div>
  )
}
