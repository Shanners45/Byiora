import Image from "next/image"

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1525]">
      <div className="text-center">
        {/* Brand Icon */}
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

        {/* Animated Progress Bar */}
        <div className="w-64 h-2 bg-white/10 rounded-full mb-6 mx-auto overflow-hidden relative">
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full animate-loading-bar"
            style={{
              background: "linear-gradient(90deg, #00BCD4, #4ECDC4, #00BCD4)",
              backgroundSize: "200% 100%",
              boxShadow:
                "0 0 20px rgba(78, 205, 196, 0.9), 0 0 8px rgba(0, 188, 212, 0.6)",
            }}
          />
        </div>

        <style>{`
          @keyframes loadingBar {
            0% { width: 0%; background-position: 0% 0%; }
            50% { width: 70%; }
            100% { width: 95%; background-position: 200% 0%; }
          }
          .animate-loading-bar {
            animation: loadingBar 2s ease-in-out infinite;
          }
        `}</style>

        {/* Loading Text */}
        <p className="text-brand-sky-blue text-sm font-medium uppercase tracking-widest drop-shadow-md">
          Loading...
        </p>
      </div>
    </div>
  )
}
