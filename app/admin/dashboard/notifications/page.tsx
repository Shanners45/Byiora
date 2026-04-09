"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Send, Users, Bell, Trash2 } from "lucide-react"
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

export default function NotificationsPage() {
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
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]">
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broadcast">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Broadcast to All Users
                    </div>
                  </SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {user.name} ({user.email})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <CardDescription className="text-[#92400E]">Notification delivery statistics</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[#4B5563]">Total Notifications</span>
                <span className="font-semibold text-[#1F2937]">{notifications.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#4B5563]">Broadcast Messages</span>
                <span className="font-semibold text-[#1F2937]">{notifications.filter((n) => !n.user_id).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#4B5563]">Direct Messages</span>
                <span className="font-semibold text-[#1F2937]">{notifications.filter((n) => n.user_id).length}</span>
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
          <CardDescription className="text-[#92400E]">Recent notifications sent to users</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Table>
            <TableHeader className="bg-white">
              <TableRow>
                <TableHead className="text-[#1F2937] font-medium">Title</TableHead>
                <TableHead className="text-[#1F2937] font-medium">Type</TableHead>
                <TableHead className="text-[#1F2937] font-medium">Recipient</TableHead>
                <TableHead className="text-[#1F2937] font-medium">Date</TableHead>
                <TableHead className="text-right text-[#1F2937] font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id} className="hover:bg-[#FEF7E0]/50">
                  <TableCell className="font-medium text-[#1F2937]">{notification.title}</TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(notification.type)}>{notification.type}</Badge>
                  </TableCell>
                  <TableCell className="text-[#4B5563]">
                    {notification.user_id ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {notification.users?.name || "Unknown User"}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        All Users
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[#4B5563]">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                      className="text-[#EF4444] border-[#EF4444]/20 hover:bg-[#EF4444]/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {notifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-[#4B5563]">
                    No notifications sent yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
