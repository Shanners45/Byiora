"use client"

import type React from "react"

import { Menu, Search, User, Bell, LogOut, Settings, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { NotificationPanel } from "./notification-panel"
import { SearchResults } from "./search-results"
import { SignInForm } from "./sign-in-form"
import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"

export function Header() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-brand-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
              <div className="h-10 relative">
                <Image
                  src="/logo-final.png"
                  alt="Byiora Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-light-gray h-4 w-4" />
              <input
                type="text"
                placeholder="Search gift cards..."
                className="w-full pl-10 pr-4 py-2 bg-brand-white border border-gray-200 rounded-lg text-brand-charcoal placeholder-brand-light-gray focus:outline-none focus:ring-2 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-brand-charcoal hover:bg-brand-sky-blue/10">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-brand-charcoal hover:bg-brand-sky-blue/10">
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
    )
  }

  return <HeaderContent />
}

function HeaderContent() {
  const { user, isLoggedIn, logout, isLoading } = useAuth()
  const { unreadCount } = useNotifications()
  const router = useRouter()
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)

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
      setIsSignInOpen(true)
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
    router.push(`/${category}/${slug}`)
  }

  if (isLoading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-brand-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
              <div className="h-10 relative">
                <Image
                  src="/byiora-logo-full.png"
                  alt="Byiora Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-light-gray h-4 w-4" />
              <input
                type="text"
                placeholder="Search gift cards..."
                className="w-full pl-10 pr-4 py-2 bg-brand-white border border-gray-200 rounded-lg text-brand-charcoal placeholder-brand-light-gray focus:outline-none focus:ring-2 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-brand-charcoal hover:bg-brand-sky-blue/10">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-brand-charcoal hover:bg-brand-sky-blue/10">
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-brand-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile sidebar */}
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
              <SheetContent side="left" className="w-80 bg-brand-white border-gray-200">
                <div className="py-6">
                  <div className="flex items-center mb-6">
                    <div className="h-10 relative">
                      <Image
                        src="/logo-final.png"
                        alt="Byiora Logo"
                        width={120}
                        height={40}
                        className="object-contain"
                      />
                    </div>
                  </div>

                  {isLoggedIn ? (
                    <>
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg mb-4">
                        <div className="w-10 h-10 rounded-full bg-brand-sky-blue flex items-center justify-center text-white">
                          {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-brand-charcoal">{user?.name || "User"}</p>
                          <p className="text-xs text-brand-light-gray">{user?.email}</p>
                        </div>
                      </div>
                      <nav className="space-y-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-brand-charcoal hover:bg-brand-sky-blue/10"
                          onClick={() => {
                            router.push("/")
                            setIsMobileSidebarOpen(false)
                          }}
                        >
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
                          Contact Us
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-red-500 hover:bg-red-50 mt-4"
                          onClick={() => {
                            logout()
                            setIsMobileSidebarOpen(false)
                          }}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      </nav>
                    </>
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
                          Contact Us
                        </Button>
                      </nav>

                      <div className="mt-6 space-y-3">
                        <Button
                          className="w-full bg-brand-sky-blue hover:bg-brand-sky-blue/90"
                          onClick={() => {
                            setIsMobileSidebarOpen(false)
                            setIsSignInOpen(true)
                          }}
                        >
                          Sign In
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full border-brand-sky-blue text-brand-sky-blue hover:bg-brand-sky-blue/10"
                          onClick={() => {
                            setIsMobileSidebarOpen(false)
                            setIsSignInOpen(true)
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

            <div className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
              <div className="h-10 relative">
                <Image
                  src="/logo-final.png"
                  alt="Byiora Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                />
              </div>
            </div>
          </div>

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

          <div className="flex items-center gap-2">
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

            {isLoggedIn ? (
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-brand-charcoal hover:bg-brand-sky-blue/10 px-3 py-2"
                  onClick={handleUserIconClick}
                >
                  <User className="h-4 w-4" />
                  <span className="hidden md:block text-sm">{user?.name || user?.email}</span>
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
            ) : (
              <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-brand-charcoal hover:bg-brand-sky-blue/10"
                    onClick={handleUserIconClick}
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-brand-white border-gray-200" aria-describedby={undefined}>
                  <SignInForm onSuccess={() => setIsSignInOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <NotificationPanel isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
    </>
  )
}
