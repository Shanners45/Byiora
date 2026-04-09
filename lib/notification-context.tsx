"use client"
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { supabase } from "./supabase"
import { useAuth } from "./auth-context"
import { toast } from "sonner"

interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  isRead: boolean
  createdAt: string
  userId?: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "isRead">) => void
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  loadNotifications: () => Promise<void>
  sendNotification: (notification: Omit<Notification, "id" | "createdAt" | "isRead">) => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { user } = useAuth()
  const currentUserId = user?.id || null

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) return

    try {
      // Load notifications for this user and broadcast notifications (userId is null)
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${currentUserId},user_id.is.null`)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading notifications:", error)
        return
      }

      const formattedNotifications = data.map((notif: any) => ({
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        isRead: notif.is_read,
        createdAt: notif.created_at,
        userId: notif.user_id,
      }))

      setNotifications(formattedNotifications)
    } catch (error) {
      console.error("Error loading notifications:", error)
    }
  }, [currentUserId])

  const addNotification = useCallback((notification: Omit<Notification, "id" | "createdAt" | "isRead">) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      isRead: false,
    }
    setNotifications((prev) => [newNotification, ...prev])
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    try {
      // Update in database
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id)

      if (error) {
        console.error("Error marking notification as read:", error)
        return
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification)),
      )
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return

    try {
      // Update all notifications for this user in database
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .or(`user_id.eq.${currentUserId},user_id.is.null`)
        .eq("is_read", false)

      if (error) {
        console.error("Error marking all notifications as read:", error)
        return
      }

      // Update local state
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })))
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }, [currentUserId])

  const sendNotification = useCallback(
    async (notification: Omit<Notification, "id" | "createdAt" | "isRead">) => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .insert([
            {
              title: notification.title,
              message: notification.message,
              type: notification.type,
              user_id: notification.userId || null,
              is_read: false,
            },
          ])
          .select()
          .single()

        if (error) {
          console.error("Error sending notification:", error)
          throw new Error("Failed to send notification")
        }

        // If it's for current user or broadcast, add to local state
        if (!notification.userId || notification.userId === currentUserId) {
          const newNotification: Notification = {
            id: data.id,
            title: data.title,
            message: data.message,
            type: data.type,
            isRead: data.is_read,
            createdAt: data.created_at,
            userId: data.user_id,
          }
          setNotifications((prev) => [newNotification, ...prev])
        }
      } catch (error) {
        console.error("Error sending notification:", error)
        throw error
      }
    },
    [currentUserId],
  )

  // Load notifications when user changes
  useEffect(() => {
    if (currentUserId) {
      loadNotifications()
    } else {
      setNotifications([]) // Clear notifications if no user
    }
  }, [currentUserId, loadNotifications])

  // Set up real-time listener for new notifications
  useEffect(() => {
    const channel = supabase
      .channel("notifications_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotif = payload.new as any
          
          // Check if it matches current user or is a broadcast
          if (!newNotif.user_id || newNotif.user_id === currentUserId) {
            const formattedNotif: Notification = {
              id: newNotif.id,
              title: newNotif.title,
              message: newNotif.message,
              type: newNotif.type,
              isRead: newNotif.is_read,
              createdAt: newNotif.created_at,
              userId: newNotif.user_id,
            }
            
            // Add to state if not already present
            setNotifications((prev) => {
              if (prev.some(n => n.id === formattedNotif.id)) return prev
              return [formattedNotif, ...prev]
            })
            
            // Show toast notification
            const toastType = formattedNotif.type === "info" ? "message" : formattedNotif.type
            // @ts-ignore - Dynamic toast method
            const toastFn = toast[formattedNotif.type] || toast.info
            
            toastFn(formattedNotif.title, {
              description: formattedNotif.message,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    loadNotifications,
    sendNotification,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
