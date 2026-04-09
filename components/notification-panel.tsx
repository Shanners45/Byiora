"use client"
import { X, Bell, Check, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotifications } from "@/lib/notification-context"

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  if (!isOpen) return null

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✅"
      case "warning":
        return "⚠️"
      case "error":
        return "❌"
      default:
        return "ℹ️"
    }
  }

  const getNotificationBorderColor = (type: string) => {
    switch (type) {
      case "success":
        return "border-l-green-500"
      case "warning":
        return "border-l-yellow-500"
      case "error":
        return "border-l-red-500"
      default:
        return "border-l-blue-500"
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="absolute right-4 top-16 w-96 max-w-[90vw] bg-white rounded-lg shadow-xl border border-gray-200 max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">{unreadCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Notifications List - Scrollable */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <ScrollArea className="h-full">
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No notifications yet</p>
                <p className="text-sm text-gray-400">We'll notify you when something important happens</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-5 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 ${getNotificationBorderColor(
                      notification.type,
                    )} ${!notification.isRead ? "bg-blue-50" : ""}`}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl flex-shrink-0 mt-1">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-base mb-1 leading-tight">
                              {notification.title}
                            </p>
                            <p className="text-gray-700 text-sm leading-relaxed mb-3 break-words">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">{formatTimeAgo(notification.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.isRead && (
                              <>
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                  className="ml-2 p-2 hover:bg-blue-100"
                                  title="Mark as read"
                                >
                                  <Check className="h-4 w-4 text-blue-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <p className="text-xs text-gray-500 text-center">
              {notifications.length} notification{notifications.length !== 1 ? "s" : ""} total
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
