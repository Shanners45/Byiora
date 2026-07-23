"use client"

import type React from "react"

import { Menu, Search, User, Bell, LogOut, Settings, History, Home, Headset, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

import { Badge } from "@/components/ui/badge"
import { NotificationPanel } from "./notification-panel"
import { SearchResults } from "./search-results"

import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import Image from "next/image"

export function Header() {
  const { user, isLoggedIn, logout, isLoading } = useAuth()
  const { unreadCount } = useNotifications()
  const router = useRouter()
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLInputElement>(null)



  // Auto-focus mobile search input when overlay opens
  useEffect(() => {
    if (isMobileSearchOpen) {
      setTimeout(() => mobileSearchRef.current?.focus(), 50)
    } else {
      setSearchQuery("")
      setShowSearchResults(false)
    }
  }, [isMobileSearchOpen])

  const handleTransactionsClick = () => {
    if (isLoggedIn) {
      router.push("/transactions")
      setIsMobileSidebarOpen(false)
    }
  }

  const handleSettingsClick = () => {
    if (isLoggedIn) {
      router.push("/settings")
      setIsMobileSidebarOpen(false)
    }
  }

  const handleUserIconClick = () => {
    if (!isLoggedIn) {
      router.push("/en-np/sign-up")
    } else {
      setIsAccountMenuOpen(!isAccountMenuOpen)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSearchResults(value.trim().length > 0)
  }

  const handleSearchItemClick = (category: string, slug: string) => {
    setSearchQuery("")
    setShowSearchResults(false)
    setIsMobileSearchOpen(false)
    router.push(`/en-np/${slug}`)
  }

  if (isLoading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-brand-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="h-10 w-[120px] bg-gray-200 animate-pulse rounded-md"></div>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-light-gray h-4 w-4" />
              <div className="w-full pl-10 pr-4 py-2 bg-brand-white border border-gray-200 rounded-lg text-brand-light-gray">
                Search gift cards...
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-brand-sky-blue/20 animate-pulse w-24 h-8 rounded-full"></div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      {/* ── Mobile Search Overlay ── */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-brand-white/98 backdrop-blur-md flex flex-col md:hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-light-gray h-4 w-4" />
              <input
                ref={mobileSearchRef}
                type="text"
                placeholder="Search gift cards..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-brand-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
              {showSearchResults && (
                <SearchResults query={searchQuery} onItemClick={handleSearchItemClick} />
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-brand-charcoal hover:bg-gray-100 flex-shrink-0"
              onClick={() => setIsMobileSearchOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          {/* Empty state hint */}
          {!searchQuery && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
              <Search className="h-12 w-12 text-gray-200" />
              <p className="text-sm text-gray-400">Start typing to search for gift cards and top-ups</p>
            </div>
          )}
        </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-brand-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile sidebar trigger */}
            <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-brand-charcoal hover:bg-brand-sky-blue/10"
                  onClick={() => setIsMobileSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-brand-white border-gray-200 flex flex-col">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SheetDescription className="sr-only">Main navigation and account options</SheetDescription>
                <div className="py-6 flex flex-col flex-1">
                  <div className="flex items-center mb-6">
                    <div className="h-10 w-[120px] relative" suppressHydrationWarning>
                      <Image
                        src="/logo-final.png"
                        alt="Byiora Logo"
                        width={120}
                        height={40}
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>

                  {isLoggedIn ? (
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg mb-4">
                        <div className="w-10 h-10 rounded-full bg-brand-sky-blue flex items-center justify-center text-white">
                          {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-brand-charcoal">{user?.name || "User"}</p>
                          <p className="text-xs text-brand-light-gray">{user?.email}</p>
                        </div>
                      </div>
                      <nav className="space-y-2 flex-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-brand-charcoal hover:bg-brand-sky-blue/10"
                          onClick={() => {
                            router.push("/")
                            setIsMobileSidebarOpen(false)
                          }}
                        >
                          <Home className="h-4 w-4 mr-2" />
                          Home
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-brand-charcoal hover:bg-brand-sky-blue/10"
                          onClick={handleTransactionsClick}
                        >
                          <History className="h-4 w-4 mr-2" />
                          Transaction History
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-brand-charcoal hover:bg-brand-sky-blue/10"
                          onClick={handleSettingsClick}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Account Settings
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-brand-charcoal hover:bg-brand-sky-blue/10"
                          onClick={() => {
                            router.push("/contact")
                            setIsMobileSidebarOpen(false)
                          }}
                        >
                          <Headset className="h-4 w-4 mr-2" />
                          Contact Us
                        </Button>
                      </nav>
                      {/* Sign Out pushed to the very bottom */}
                      <div className="mt-auto">
                        <div className="border-t border-dashed border-gray-300 my-4" />
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-red-500 hover:bg-red-50"
                          onClick={() => {
                            logout()
                            setIsMobileSidebarOpen(false)
                          }}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <nav className="space-y-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-brand-charcoal hover:bg-brand-sky-blue/10"
                          onClick={() => {
                            router.push("/")
                            setIsMobileSidebarOpen(false)
                          }}
                        >
                          <Home className="h-4 w-4 mr-2" />
                          Home
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-brand-charcoal hover:bg-brand-sky-blue/10"
                          onClick={() => {
                            router.push("/contact")
                            setIsMobileSidebarOpen(false)
                          }}
                        >
                          <Headset className="h-4 w-4 mr-2" />
                          Contact Us
                        </Button>
                      </nav>

                      <div className="mt-6 space-y-3">
                        <Button
                          className="w-full bg-brand-sky-blue hover:bg-brand-sky-blue/90"
                          onClick={() => {
                            setIsMobileSidebarOpen(false)
                            router.push("/en-np/sign-up")
                          }}
                        >
                          Sign In
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full border-brand-sky-blue text-brand-sky-blue hover:bg-brand-sky-blue/10"
                          onClick={() => {
                            setIsMobileSidebarOpen(false)
                            router.push("/en-np/sign-up")
                          }}
                        >
                          Create Account
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <div className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
              <div className="h-10 w-[120px] relative" suppressHydrationWarning>
                <Image
                  src="/logo-final.png"
                  alt="Byiora Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Desktop search bar */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-light-gray h-4 w-4" />
              <input
                type="text"
                placeholder="Search gift cards..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="w-full pl-10 pr-4 py-2 bg-brand-white border border-gray-200 rounded-lg text-brand-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
              {showSearchResults && <SearchResults query={searchQuery} onItemClick={handleSearchItemClick} />}
            </div>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-1">
            {/* Mobile-only search icon */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-brand-charcoal hover:bg-brand-sky-blue/10"
              onClick={() => setIsMobileSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
            </Button>

            {isLoggedIn ? (
              <>
                {/* Bell — visible on all screen sizes when logged in */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-brand-charcoal hover:bg-brand-sky-blue/10"
                    onClick={() => setIsNotificationOpen(true)}
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center p-0">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </div>

                {/* Account dropdown — desktop only */}
                <div className="relative hidden md:block">
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 text-brand-charcoal hover:bg-brand-sky-blue/10 px-3 py-2"
                    onClick={handleUserIconClick}
                  >
                    <User className="h-4 w-4" />
                    <span className="text-sm">{user?.name || user?.email}</span>
                  </Button>

                  {isAccountMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                      <div className="py-1">
                        <button
                          onClick={handleTransactionsClick}
                          className="w-full text-left px-4 py-2 text-sm text-brand-charcoal hover:bg-brand-sky-blue/10 flex items-center"
                        >
                          <History className="h-4 w-4 mr-2" />
                          Transaction History
                        </button>
                        <button
                          onClick={handleSettingsClick}
                          className="w-full text-left px-4 py-2 text-sm text-brand-charcoal hover:bg-brand-sky-blue/10 flex items-center"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Account Settings
                        </button>
                        <div className="border-t border-gray-200 my-1"></div>
                        <button
                          onClick={() => {
                            logout()
                            setIsAccountMenuOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-brand-charcoal hover:bg-brand-sky-blue/10 flex items-center"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Sign Up button — visible on ALL screen sizes when logged out */
              <Button
                size="sm"
                className="bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white font-semibold px-4 py-1.5 h-8 rounded-full text-sm"
                onClick={() => router.push("/en-np/sign-up")}
              >
                Sign Up
              </Button>
            )}
          </div>
        </div>
      </header>

      <NotificationPanel isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />

    </>
  )
}
