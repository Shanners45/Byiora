"use client"
import { X, CheckCheck, Check } from "lucide-react"
import { useNotifications } from "@/lib/notification-context"

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
}

// Modern SVG icons per notification type
const TypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "success":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    case "warning":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    case "error":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
  }
}

const typeConfig: Record<string, { bg: string; iconBg: string; iconColor: string; dot: string }> = {
  success: {
    bg: "hover:bg-gray-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "hover:bg-gray-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    dot: "bg-amber-500",
  },
  error: {
    bg: "hover:bg-gray-50",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    dot: "bg-red-500",
  },
  info: {
    bg: "hover:bg-gray-50",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    dot: "bg-blue-500",
  },
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

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

      {/* Panel — compact popup card centered on mobile, right-aligned on desktop */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-14 sm:left-auto sm:translate-x-0 sm:right-4 sm:top-16 w-[92vw] sm:w-[400px] max-h-[70vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white border border-gray-200/60"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header — clean white */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px] text-gray-600" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 leading-tight">Notifications</h3>
              <p className="text-gray-400 text-xs">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
                <span className="sm:hidden">All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
        >
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-gray-300" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No notifications yet</p>
              <p className="text-xs text-gray-400 max-w-[220px]">We&apos;ll let you know when something important happens</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification, idx) => {
                const cfg = typeConfig[notification.type] || typeConfig.info
                return (
                  <div
                    key={notification.id}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                    className={`
                      flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors
                      ${!notification.isRead ? "bg-gray-50/80" : "bg-transparent"}
                      ${cfg.bg}
                      ${idx !== 0 ? "border-t border-gray-100" : ""}
                    `}
                  >
                    {/* Icon pill */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.iconBg} ${cfg.iconColor}`}>
                      <TypeIcon type={notification.type} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 leading-snug mb-0.5 break-words">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cfg.dot}`} />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-2 break-words">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-gray-400 font-medium">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(notification.id)
                            }}
                            className="flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex-shrink-0">
            <p className="text-[11px] text-gray-400 text-center tracking-wide">
              {notifications.length} notification{notifications.length !== 1 ? "s" : ""} &middot; {unreadCount} unread
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
