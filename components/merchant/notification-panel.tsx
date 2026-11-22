"use client"

import { useEffect, useState } from "react"
import { X, CheckCheck, Bell, Megaphone } from "lucide-react"
import { listMyNotificationsAction, markNotificationsSeenAction, type NotificationRow } from "@/app/actions/merchant-notifications"

// Same popup as the storefront's notification panel, fed by admin messages to merchants.

const timeAgo = (d: string) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export function MerchantNotificationPanel({ isOpen, onClose, unread, tick, onSeen }: { isOpen: boolean; onClose: () => void; unread: number; tick: number; onSeen: () => void }) {
  const [rows, setRows] = useState<NotificationRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // Reload from page 1 whenever it opens or a new message arrives while open.
  useEffect(() => {
    if (!isOpen) return
    setPage(1)
    listMyNotificationsAction(1).then((d) => { setRows(d?.rows || []); setTotal(d?.total || 0) })
  }, [isOpen, tick])

  const more = async () => {
    const d = await listMyNotificationsAction(page + 1)
    if (!d) return
    setRows((r) => [...(r || []), ...d.rows])
    setPage(page + 1)
  }
  const markAll = async () => {
    await markNotificationsSeenAction()
    setRows((r) => (r || []).map((n) => ({ ...n, unread: false })))
    onSeen()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
      <div
        className="absolute left-1/2 -translate-x-1/2 top-14 sm:left-auto sm:translate-x-0 sm:right-4 sm:top-16 w-[92vw] sm:w-[400px] max-h-[70vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white border border-gray-200/60"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Bell className="w-[18px] h-[18px] text-gray-600" /></div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 leading-tight">Notifications</h3>
              <p className="text-gray-400 text-xs">{unread > 0 ? `${unread} unread` : "All caught up"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                <CheckCheck className="w-3.5 h-3.5" />Mark all read
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}>
          {!rows ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-t-[#7E3AF2] border-gray-200" /></div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><Bell className="w-8 h-8 text-gray-300" /></div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No notifications yet</p>
              <p className="text-xs text-gray-400 max-w-[220px]">Announcements from the Byiora team show up here</p>
            </div>
          ) : (
            <div>
              {rows.map((n, idx) => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3.5 ${n.unread ? "bg-gray-50/80" : ""} ${idx ? "border-t border-gray-100" : ""}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${n.toAll ? "bg-amber-100 text-amber-600" : "bg-purple-100 text-[#7E3AF2]"}`}>
                    {n.toAll ? <Megaphone className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 leading-snug mb-0.5 break-words">{n.title}</p>
                      {n.unread && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-[#7E3AF2]" />}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-2 break-words whitespace-pre-line">{n.body}</p>
                    <span className="text-[11px] text-gray-400 font-medium">{timeAgo(n.createdAt)}{n.toAll ? " · All merchants" : ""}</span>
                  </div>
                </div>
              ))}
              {rows.length < total && (
                <button onClick={more} className="w-full py-3 text-xs font-semibold text-[#7E3AF2] hover:bg-gray-50 border-t border-gray-100">Show older</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
