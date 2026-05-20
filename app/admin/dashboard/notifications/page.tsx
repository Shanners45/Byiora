"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Send, Users, Bell, Trash2, Search, ChevronDown, X } from "lucide-react"
import { getAllUsersAction, getAllNotificationsAction, sendNotificationAction, deleteNotificationAction } from "@/app/actions/dashboard"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  user_id: string | null
  is_read: boolean
  created_at: string
  users?: {
    name: string
    email: string
  }
}

interface User {
  id: string
  name: string
  email: string
}

// Known title prefixes for auto-generated order notifications
const AUTO_NOTIFICATION_PREFIXES = [
  "Order Placed Successfully",
  "Order Completed",
  "Order Failed",
]

function isAutoNotification(notification: Notification): boolean {
  return AUTO_NOTIFICATION_PREFIXES.some((prefix) =>
    notification.title.startsWith(prefix),
  )
}

// ─── Searchable Recipient Picker ────────────────────────────────────────────
function RecipientPicker({
  users,
  value,
  onChange,
}: {
  users: User[]
  value: string
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setSearch("")
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [users, search])

  const selectedLabel = useMemo(() => {
    if (value === "broadcast") return "Broadcast to All Users"
    const user = users.find((u) => u.id === value)
    return user ? `${user.name} (${user.email})` : "Select recipient"
  }, [value, users])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full h-10 px-3 py-2 text-sm bg-white border-2 border-[#F59E0B]/30 rounded-md focus:border-[#F59E0B] focus:outline-none hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 truncate text-left">
          <Users className="h-4 w-4 flex-shrink-0 text-gray-500" />
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-150">
          {/* Search bar inside dropdown */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#F59E0B] placeholder:text-gray-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-[240px] overflow-y-auto">
            {/* Broadcast option always visible */}
            {(!search.trim()) && (
              <button
                type="button"
                onClick={() => { onChange("broadcast"); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-[#FEF7E0] transition-colors ${value === "broadcast" ? "bg-[#FEF7E0] font-medium" : ""}`}
              >
                <Users className="h-4 w-4 flex-shrink-0 text-[#F59E0B]" />
                <span>Broadcast to All Users</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-gray-400">
                No users found
              </div>
            ) : (
              filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => { onChange(user.id); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-[#FEF7E0] transition-colors ${value === user.id ? "bg-[#FEF7E0] font-medium" : ""}`}
                >
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-gray-900">{user.name}</div>
                    <div className="truncate text-xs text-gray-500">{user.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NotificationsPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<User[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [type, setType] = useState<"info" | "success" | "warning" | "error">("info")
  const [selectedUser, setSelectedUser] = useState("broadcast")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadUsers()
    loadNotifications()
  }, [])

  const loadUsers = async () => {
    try {
      const result = await getAllUsersAction()

      if (result.error) {
        console.error("Error loading users:", result.error)
        return
      }

      setUsers(result.data || [])
    } catch (error) {
      console.error("Error loading users:", error)
    }
  }

  const loadNotifications = async () => {
    try {
      const result = await getAllNotificationsAction()

      if (result.error) {
        console.error("Error loading notifications:", result.error)
        return
      }

      setNotifications(result.data || [])
    } catch (error) {
      console.error("Error loading notifications:", error)
    }
  }

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in all fields")
      return
    }

    setIsLoading(true)

    try {
      const result = await sendNotificationAction(
        title.trim(),
        message.trim(),
        type,
        selectedUser === "broadcast" ? null : selectedUser
      )

      if (result.error) {
        console.error("Error sending notification:", result.error)
        toast.error(result.error)
        return
      }

      toast.success(
        selectedUser === "broadcast"
          ? "Broadcast notification sent successfully!"
          : "Notification sent to user successfully!",
      )

      // Reset form
      setTitle("")
      setMessage("")
      setType("info")
      setSelectedUser("broadcast")

      // Reload notifications
      loadNotifications()
    } catch (error: any) {
      console.error("Error sending notification:", error)
      toast.error(error?.message || "Failed to send notification")
    } finally {
      setIsLoading(false)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const result = await deleteNotificationAction(id)

      if (result.error) {
        console.error("Error deleting notification:", result.error)
        toast.error(result.error)
        return
      }

      toast.success("Notification deleted successfully")
      loadNotifications()
    } catch (error: any) {
      console.error("Error deleting notification:", error)
      toast.error(error?.message || "Failed to delete notification")
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-100 text-green-800"
      case "warning":
        return "bg-yellow-100 text-yellow-800"
      case "error":
        return "bg-red-100 text-red-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  // Filter out automatic order notifications — only show admin-sent ones
  const manualNotifications = notifications.filter((n) => !isAutoNotification(n))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Notifications</h1>
        <p className="text-[#4B5563]">Send notifications to users and manage notification history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Notification */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937] flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Notification
            </CardTitle>
            <CardDescription className="text-[#92400E]">
              Send notifications to specific users or broadcast to all users
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient" className="text-[#1F2937]">
                Recipient
              </Label>
              <RecipientPicker
                users={users}
                value={selectedUser}
                onChange={setSelectedUser}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-[#1F2937]">
                Type
              </Label>
              <Select value={type} onValueChange={(value: "info" | "success" | "warning" | "error") => setType(value)}>
                <SelectTrigger className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ Info</SelectItem>
                  <SelectItem value="success">✅ Success</SelectItem>
                  <SelectItem value="warning">⚠️ Warning</SelectItem>
                  <SelectItem value="error">❌ Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-[#1F2937]">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter notification title"
                className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-[#1F2937]">
                Message
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter notification message"
                className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500 min-h-[100px]"
              />
            </div>

            <Button
              onClick={sendNotification}
              disabled={isLoading}
              className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              {isLoading ? "Sending..." : "Send Notification"}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Statistics */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937] flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Statistics
            </CardTitle>
            <CardDescription className="text-[#92400E]">Admin notification delivery statistics</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[#4B5563]">Total Notifications</span>
                <span className="font-semibold text-[#1F2937]">{manualNotifications.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#4B5563]">Broadcast Messages</span>
                <span className="font-semibold text-[#1F2937]">{manualNotifications.filter((n) => !n.user_id).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#4B5563]">Direct Messages</span>
                <span className="font-semibold text-[#1F2937]">{manualNotifications.filter((n) => n.user_id).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#4B5563]">Active Users</span>
                <span className="font-semibold text-[#1F2937]">{users.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification History */}
      <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
        <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937]">Notification History</CardTitle>
          <CardDescription className="text-[#92400E]">Click on a recipient to view their notification history</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {manualNotifications.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-[#4B5563]">
              No notifications sent yet.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Process Broadcasts first */}
              {(() => {
                const broadcasts = manualNotifications.filter(n => !n.user_id)
                if (broadcasts.length === 0) return null
                return <CollapsibleGroup title="Broadcast Messages" subtitle="All users" count={broadcasts.length} icon={<Users className="h-4 w-4" />} color="blue" items={broadcasts} deleteFn={deleteNotification} getTypeColor={getTypeColor} />
              })()}

              {/* Grouped User Notifications */}
              {Array.from(new Set(manualNotifications.filter(n => n.user_id).map(n => n.user_id))).map(userId => {
                const userNotifications = manualNotifications.filter(n => n.user_id === userId)
                const user = userNotifications[0].users
                return (
                  <CollapsibleGroup 
                    key={userId}
                    title={user?.name || "Unknown User"} 
                    subtitle={user?.email || "No email"} 
                    count={userNotifications.length} 
                    icon={<Users className="h-4 w-4" />} 
                    color="purple" 
                    items={userNotifications} 
                    deleteFn={deleteNotification} 
                    getTypeColor={getTypeColor} 
                  />
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CollapsibleGroup({ title, subtitle, count, icon, color, items, deleteFn, getTypeColor }: any) {
  const [isOpen, setIsOpen] = useState(false)
  const colorClasses: any = {
    blue: "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100",
    purple: "bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100"
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${isOpen ? 'ring-1 ring-[#F59E0B]' : ''}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#1F2937] truncate">{title}</h3>
          <p className="text-xs text-[#4B5563] truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`${color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'} border-none`}>
            {count}
          </Badge>
          <div className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </button>
      
      {isOpen && (
        <div className="bg-[#FDFDFD] border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
          <Table>
            <TableBody>
              {items.map((n: any) => (
                <TableRow key={n.id} className="hover:bg-gray-50 border-gray-100">
                  <TableCell className="w-[180px] font-medium text-[#1F2937] pl-6">{n.title}</TableCell>
                  <TableCell className="w-[100px]">
                    <Badge className={`${getTypeColor(n.type)} border-none text-[10px]`}>{n.type}</Badge>
                  </TableCell>
                  <TableCell className="text-[#4B5563] text-sm py-3">{n.message}</TableCell>
                  <TableCell className="w-[120px] text-[#4B5563] text-xs">
                    {new Date(n.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right w-[60px] pr-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteFn(n.id)
                      }}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
