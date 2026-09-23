"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Users,
  ShieldAlert,
  Mail,
  Search,
  KeyRound,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  RefreshCw,
  ShoppingBag,
  Clock,
  SendHorizontal,
  FileText,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Copy,
  ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  getCustomersOverviewAction,
  sendCustomerPasswordResetAction,
  banEntireCustomerAction,
  unbanEntireCustomerAction,
  banCustomerAction,
  unbanCustomerAction,
  getBannedListAction,
  getCustomerOrdersAction,
  CustomerProfile,
} from "@/app/actions/customers"
import {
  getSupportTicketsAction,
  replyToSupportTicketAction,
  updateTicketStatusAction,
  SupportTicket,
} from "@/app/actions/support-tickets"
import { resendExistingGiftcardCodeAction } from "@/app/actions/orders"
import { getAdminSessionAction } from "@/app/actions/admin-utils"
import { BannedEntity } from "@/lib/security/blacklist"

const GoogleIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function CustomersAndSecurityPage() {
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin")
  const [activeTab, setActiveTab] = useState("customers")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const isSubAdmin = currentUserRole === "sub_admin"

  // Data states
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [bans, setBans] = useState<BannedEntity[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])

  // Search & filter states
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [banSearch, setBanSearch] = useState("")
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [blacklistPage, setBlacklistPage] = useState(1)
  const [ticketsPage, setTicketsPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [customerSearch, customerFilter])

  useEffect(() => {
    setBlacklistPage(1)
  }, [banSearch])

  useEffect(() => {
    setTicketsPage(1)
  }, [ticketStatusFilter])

  // Unified Customer Ban Modal (Bans Email, IP, Device, and Auth Account)
  const [customerToBan, setCustomerToBan] = useState<CustomerProfile | null>(null)
  const [customerBanReason, setCustomerBanReason] = useState("")
  const [customerBanDuration, setCustomerBanDuration] = useState("0")
  const [customerBanIp, setCustomerBanIp] = useState(false)
  const [customerBanDomain, setCustomerBanDomain] = useState(false)
  const [submittingCustomerBan, setSubmittingCustomerBan] = useState(false)

  // Manual Blacklist Modal
  const [banModalOpen, setBanModalOpen] = useState(false)
  const [banType, setBanType] = useState<"email" | "ip" | "email_domain" | "device_id">("email")
  const [banValue, setBanValue] = useState("")
  const [banReason, setBanReason] = useState("")
  const [banDuration, setBanDuration] = useState("0")
  const [submittingBan, setSubmittingBan] = useState(false)

  // Customer Order Drilldown Modal (with 1-click Resend Code & Pagination)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [customerOrdersPage, setCustomerOrdersPage] = useState(1)
  const ordersPageSize = 10
  const [resendingCodeTxnId, setResendingCodeTxnId] = useState<string | null>(null)

  // Reply Modal for Support Tickets
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [replyMessage, setReplyMessage] = useState("")
  const [sendingReply, setSendingReply] = useState(false)

  // Password reset confirmation
  const [resetModalEmail, setResetModalEmail] = useState<string | null>(null)
  const [sendingReset, setSendingReset] = useState(false)

  // Lift ban confirmation modal
  const [unbanTarget, setUnbanTarget] = useState<{
    id: string
    target: string
    type?: "email" | "ip" | "email_domain" | "device_id"
    isCustomerEmail: boolean
    customerName?: string
  } | null>(null)
  const [submittingUnban, setSubmittingUnban] = useState(false)

  // Load all initial data (showSkeleton only on first mount; subsequent loads are silent)
  const loadData = async (showSkeleton = false) => {
    if (showSkeleton) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      const session = await getAdminSessionAction()
      const role = session.success ? session.data.role : "admin"
      setCurrentUserRole(role)

      if (role === "sub_admin") {
        setActiveTab("support")
        const tickRes = await getSupportTicketsAction()
        if (tickRes.success && tickRes.data) setTickets(tickRes.data)
        return
      }

      const [custRes, banRes, tickRes] = await Promise.all([
        getCustomersOverviewAction(),
        getBannedListAction(),
        getSupportTicketsAction(),
      ])

      if (custRes.success && custRes.data) setCustomers(custRes.data)
      if (banRes.success && banRes.data) setBans(banRes.data)
      if (tickRes.success && tickRes.data) setTickets(tickRes.data)
    } catch (err) {
      console.error("Failed to load customer & security data:", err)
      toast.error("Failed to load data")
    } finally {
      if (showSkeleton) setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData(true)
  }, [])

  // ── Customer Handlers ──
  const handleViewCustomerOrders = async (cust: CustomerProfile) => {
    setSelectedCustomer(cust)
    setIsCustomerModalOpen(true)
    setCustomerOrders([])
    setCustomerOrdersPage(1)
    setLoadingOrders(true)
    try {
      const res = await getCustomerOrdersAction(cust.email)
      if (res.success && res.data) {
        setCustomerOrders(res.data)
      } else {
        setCustomerOrders([])
      }
    } catch (e) {
      setCustomerOrders([])
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleResendGiftcardCode = async (transactionId: string) => {
    setResendingCodeTxnId(transactionId)
    try {
      const res = await resendExistingGiftcardCodeAction(transactionId)
      if (res.success) {
        toast.success(res.message || "Gift card code resent successfully to customer email!")
      } else {
        toast.error(res.error || "Failed to resend code")
      }
    } catch (err: any) {
      toast.error(err.message || "Error resending code")
    } finally {
      setResendingCodeTxnId(null)
    }
  }

  const handleSendPasswordReset = async (email: string) => {
    setSendingReset(true)
    try {
      const res = await sendCustomerPasswordResetAction(email)
      if (res.success) {
        toast.success(`Password reset email delivered to ${email}!`)
        setResetModalEmail(null)
      } else {
        toast.error(res.error || "Failed to send password reset")
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred")
    } finally {
      setSendingReset(false)
    }
  }

  const handleOpenCustomerBan = (cust: CustomerProfile) => {
    setCustomerToBan(cust)
    setCustomerBanReason("Suspicious activity / policy violation")
    setCustomerBanDuration("0") // default permanent
    setCustomerBanIp(false)
    setCustomerBanDomain(false)
  }

  const handleConfirmCustomerBan = async () => {
    if (!customerToBan) return
    const targetEmail = customerToBan.email
    const reason = customerBanReason.trim() || "Suspicious activity / policy violation"
    setSubmittingCustomerBan(true)
    try {
      const hours = parseInt(customerBanDuration) || 0
      const res = await banEntireCustomerAction({
        email: targetEmail,
        reason,
        durationHours: hours > 0 ? hours : undefined,
        banIp: customerBanIp,
        banDomain: customerBanDomain,
      })
      if (res.success) {
        toast.success(res.message || `Customer ${targetEmail} banned successfully!`)
        setCustomerToBan(null)
        // Instant in-place optimistic state update (no full-page reload)
        setCustomers((prev) =>
          prev.map((c) =>
            c.email.toLowerCase() === targetEmail.toLowerCase()
              ? { ...c, isBanned: true, banReason: reason }
              : c
          )
        )
        if (selectedCustomer?.email.toLowerCase() === targetEmail.toLowerCase()) {
          setSelectedCustomer((prev) => (prev ? { ...prev, isBanned: true, banReason: reason } : null))
        }
        // Silently sync in background without page refresh
        loadData(false)
      } else {
        toast.error(res.error || "Failed to ban customer")
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred")
    } finally {
      setSubmittingCustomerBan(false)
    }
  }

  const handleOpenUnbanForCustomer = (cust: CustomerProfile) => {
    setUnbanTarget({
      id: cust.email,
      target: cust.email,
      type: "email",
      isCustomerEmail: true,
      customerName: cust.name || undefined,
    })
  }

  const handleOpenUnban = (item: {
    id: string
    target: string
    type?: "email" | "ip" | "email_domain" | "device_id"
    isCustomerEmail: boolean
    customerName?: string
  }) => {
    setUnbanTarget(item)
  }

  const handleConfirmUnban = async () => {
    if (!unbanTarget) return
    const item = unbanTarget
    setSubmittingUnban(true)
    try {
      // Instant in-place optimistic state update (no full-page reload)
      if (item.isCustomerEmail) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.email.toLowerCase() === item.target.toLowerCase()
              ? { ...c, isBanned: false, banReason: null, banId: null }
              : c
          )
        )
        if (selectedCustomer?.email.toLowerCase() === item.target.toLowerCase()) {
          setSelectedCustomer((prev) => (prev ? { ...prev, isBanned: false, banReason: null, banId: null } : null))
        }
        setBans((prev) =>
          prev.filter(
            (b) =>
              b.id !== item.id &&
              !(b.type === "email" && b.value.toLowerCase() === item.target.toLowerCase()) &&
              !(b.type === "device_id" && b.reason?.toLowerCase().includes(item.target.toLowerCase()))
          )
        )
      } else {
        setBans((prev) => prev.filter((b) => b.id !== item.id))
      }

      setUnbanTarget(null)

      const res = item.isCustomerEmail
        ? await unbanEntireCustomerAction(item.target)
        : await unbanCustomerAction(item.id)

      if (res.success) {
        toast.success(`Ban lifted for ${item.target}! Access restored.`)
        loadData(false)
      } else {
        toast.error(res.error || "Failed to lift ban")
        loadData(false)
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred")
      loadData(false)
    } finally {
      setSubmittingUnban(false)
    }
  }

  const handleCreateBan = async () => {
    if (!banValue.trim()) return toast.error("Please enter a target to ban")
    setSubmittingBan(true)
    try {
      const hours = parseInt(banDuration) || 0
      const res = await banCustomerAction({
        type: banType,
        value: banValue.trim(),
        reason: banReason.trim() || undefined,
        durationHours: hours > 0 ? hours : undefined,
      })
      if (res.success) {
        toast.success(`Rule added successfully!`)
        setBanModalOpen(false)
        setBanValue("")
        setBanReason("")
        setBanDuration("0")
        loadData(false)
      } else {
        toast.error(res.error || "Failed to add ban")
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred")
    } finally {
      setSubmittingBan(false)
    }
  }

  // ── Support Ticket Handlers ──
  const handleSendTicketReply = async () => {
    if (!selectedTicket) return
    if (!replyMessage.trim()) return toast.error("Please write a reply message")

    setSendingReply(true)
    try {
      const res = await replyToSupportTicketAction({
        ticketId: selectedTicket.id,
        replyMessage: replyMessage.trim(),
      })

      if (res.success) {
        toast.success(`Reply delivered directly to ${selectedTicket.email}!`)
        setIsTicketModalOpen(false)
        setTimeout(() => {
          setSelectedTicket(null)
          setReplyMessage("")
        }, 300)
        loadData()
      } else {
        toast.error(res.error || "Failed to send reply")
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred")
    } finally {
      setSendingReply(false)
    }
  }

  const handleMarkTicketStatus = async (ticketId: string, status: "open" | "replied" | "resolved" | "closed") => {
    try {
      const res = await updateTicketStatusAction(ticketId, status)
      if (res.success) {
        toast.success(`Ticket marked as ${status}!`)
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket((prev) => (prev ? { ...prev, status } : null))
        }
        loadData()
      } else {
        toast.error(res.error || "Failed to update status")
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred")
    }
  }

  // ── Filters ──
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase())

    if (!matchesSearch) return false

    if (customerFilter === "registered") return c.isRegistered && c.isEmailVerified !== false
    if (customerFilter === "unverified") return c.isRegistered && c.isEmailVerified === false
    if (customerFilter === "guest") return !c.isRegistered
    if (customerFilter === "banned") return c.isBanned
    return true
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Blacklist rules list: Displays customer email bans, IP address bans, and domain bans
  // separately so that admins can lift bans from individual IP addresses or domains independently.
  const consolidatedBans = useMemo(() => {
    const emailBans = bans.filter((b) => b.type === "email")
    const ipBans = bans.filter((b) => b.type === "ip")
    const domainBans = bans.filter((b) => b.type === "email_domain")

    // Standalone device ID bans (e.g. manually added, not internal auxiliary attached to an existing email ban)
    const bannedEmails = new Set(emailBans.map((b) => b.value.toLowerCase().trim()))
    const standaloneDeviceBans = bans.filter((b) => {
      if (b.type !== "device_id") return false
      const match = b.reason?.match(/\(Associated with ([^)]+)\)/i)
      const associatedEmail = match ? match[1].toLowerCase().trim() : null
      return !associatedEmail || !bannedEmails.has(associatedEmail)
    })

    const combined: Array<{
      id: string
      target: string
      type: "email" | "ip" | "email_domain" | "device_id"
      isCustomerEmail: boolean
      customerName?: string
      associatedEmail?: string
      linkedCustomers?: string[]
      reason: string
      expires_at?: string | null
      created_at: string
      rawBan: BannedEntity
    }> = []

    // 1. Customer Email Bans
    for (const eb of emailBans) {
      const cust = customers.find((c) => c.email.toLowerCase() === eb.value.toLowerCase().trim())
      const cleanReason = (eb.reason || "Suspicious activity / policy violation").replace(/\s*\(Associated with [^)]+\)/i, "")
      const linkedCustomers = customers
        .filter(
          (c) =>
            c.isBanned &&
            c.email.toLowerCase() !== eb.value.toLowerCase().trim() &&
            (c.banReason?.toLowerCase().includes(eb.value.toLowerCase().trim()) ||
              (cust?.lastDeviceId && c.lastDeviceId && c.lastDeviceId === cust.lastDeviceId) ||
              (cust?.lastIp && c.lastIp && c.lastIp === cust.lastIp))
        )
        .map((c) => c.email)

      combined.push({
        id: eb.id,
        target: eb.value,
        type: "email",
        isCustomerEmail: true,
        customerName: cust?.name,
        linkedCustomers,
        reason: cleanReason,
        expires_at: eb.expires_at,
        created_at: eb.created_at,
        rawBan: eb,
      })
    }

    // 2. IP Address Bans (displayed separately so admin can lift ban from a single IP address)
    for (const ib of ipBans) {
      const match = ib.reason?.match(/\(Associated with ([^)]+)\)/i)
      const associatedEmail = match ? match[1].trim() : undefined
      const cleanReason = (ib.reason || "IP blacklist rule").replace(/\s*\(Associated with [^)]+\)/i, "")

      combined.push({
        id: ib.id,
        target: ib.value,
        type: "ip",
        isCustomerEmail: false,
        associatedEmail,
        reason: cleanReason,
        expires_at: ib.expires_at,
        created_at: ib.created_at,
        rawBan: ib,
      })
    }

    // 3. Domain Address Bans (displayed separately so admin can lift ban from a single domain address)
    for (const db of domainBans) {
      const match = db.reason?.match(/\((?:Domain banned for|Associated with) ([^)]+)\)/i)
      const associatedEmail = match ? match[1].trim() : undefined
      const cleanReason = (db.reason || "Domain blacklist rule").replace(/\s*\((?:Domain banned for|Associated with) [^)]+\)/i, "")
      const displayTarget = db.value.startsWith("@") ? db.value : `@${db.value}`

      combined.push({
        id: db.id,
        target: displayTarget,
        type: "email_domain",
        isCustomerEmail: false,
        associatedEmail,
        reason: cleanReason,
        expires_at: db.expires_at,
        created_at: db.created_at,
        rawBan: db,
      })
    }

    // 4. Standalone Device Bans (manually added)
    for (const db of standaloneDeviceBans) {
      const cleanReason = (db.reason || "Device blacklist rule").replace(/\s*\(Associated with [^)]+\)/i, "")
      combined.push({
        id: db.id,
        target: db.value,
        type: "device_id",
        isCustomerEmail: false,
        reason: cleanReason,
        expires_at: db.expires_at,
        created_at: db.created_at,
        rawBan: db,
      })
    }

    return combined
  }, [bans, customers])

  const filteredBans = consolidatedBans.filter((b) =>
    b.target.toLowerCase().includes(banSearch.toLowerCase()) ||
    (b.customerName && b.customerName.toLowerCase().includes(banSearch.toLowerCase())) ||
    (b.associatedEmail && b.associatedEmail.toLowerCase().includes(banSearch.toLowerCase())) ||
    b.reason.toLowerCase().includes(banSearch.toLowerCase())
  )
  const totalBlacklistPages = Math.ceil(filteredBans.length / pageSize) || 1
  const paginatedBans = filteredBans.slice((blacklistPage - 1) * pageSize, blacklistPage * pageSize)

  const filteredTickets = tickets.filter((t) => {
    if (ticketStatusFilter === "all") return true
    return t.status === ticketStatusFilter
  })
  const totalTicketsPages = Math.ceil(filteredTickets.length / pageSize) || 1
  const paginatedTickets = filteredTickets.slice((ticketsPage - 1) * pageSize, ticketsPage * pageSize)

  // Customer statistics (count only verified registered accounts)
  const totalSpendRs = customers.reduce((acc, c) => acc + c.totalSpent, 0)
  const bannedCount = customers.filter((c) => c.isBanned).length
  const registeredCount = customers.filter((c) => c.isRegistered && c.isEmailVerified !== false).length
  const guestCount = customers.filter((c) => !c.isRegistered).length
  const openTicketsCount = tickets.filter((t) => t.status === "open").length

  if (loading) {
    if (isSubAdmin) {
      return (
        <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">
          {/* Skeleton Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 sm:h-8 w-44 sm:w-48 bg-[#FEF7E0]" />
              <Skeleton className="h-3.5 sm:h-4 w-60 sm:w-72 bg-[#FEF7E0]/70" />
            </div>
            <Skeleton className="h-9 w-24 self-start sm:self-auto bg-[#FEF7E0] border border-[#F59E0B]/30" />
          </div>

          {/* Skeleton Support Inbox Table Card */}
          <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Skeleton className="h-5 sm:h-6 w-36 bg-[#F59E0B]/25" />
                <Skeleton className="h-3 w-48 sm:w-64 bg-[#F59E0B]/15" />
              </div>
              <Skeleton className="h-9 sm:h-10 w-full sm:w-48 bg-white rounded-lg border border-[#F59E0B]/20" />
            </div>
            <div className="space-y-2.5 bg-white p-3 sm:p-4 rounded-xl border border-[#F59E0B]/20">
              <Skeleton className="h-9 w-full bg-amber-50" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-50" />
              ))}
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">
        {/* Skeleton Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 sm:h-8 w-52 sm:w-64 bg-[#FEF7E0]" />
            <Skeleton className="h-3.5 sm:h-4 w-full max-w-sm bg-[#FEF7E0]/70" />
          </div>
          <Skeleton className="h-9 w-24 self-start sm:self-auto bg-[#FEF7E0] border border-[#F59E0B]/30" />
        </div>

        {/* Skeleton Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-9 sm:h-11 w-36 sm:w-44 rounded-xl bg-[#FEF7E0] shrink-0" />
          <Skeleton className="h-9 sm:h-11 w-44 sm:w-48 rounded-xl bg-[#FEF7E0]/80 shrink-0" />
          <Skeleton className="h-9 sm:h-11 w-36 sm:w-44 rounded-xl bg-[#FEF7E0]/80 shrink-0" />
        </div>

        {/* Skeleton Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md p-3.5 sm:p-5 space-y-2 sm:space-y-3">
              <Skeleton className="h-3.5 sm:h-4 w-20 sm:w-28 bg-[#F59E0B]/20" />
              <Skeleton className="h-6 sm:h-8 w-16 sm:w-24 bg-[#F59E0B]/30" />
            </Card>
          ))}
        </div>

        {/* Skeleton Main Directory Table Card */}
        <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 bg-[#F59E0B]/25" />
            <Skeleton className="h-4 w-80 bg-[#F59E0B]/15" />
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Skeleton className="h-10 flex-1 bg-white rounded-lg border border-[#F59E0B]/20" />
            <Skeleton className="h-10 w-full md:w-52 bg-white rounded-lg border border-[#F59E0B]/20" />
          </div>
          <div className="space-y-3 bg-white p-4 rounded-xl border border-[#F59E0B]/20">
            <Skeleton className="h-10 w-full bg-amber-50" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-slate-50" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  const supportInboxCard = (
    <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl overflow-hidden">
      <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <CardTitle className="text-[#1F2937] flex items-center gap-2">
            <span>Support Inbox</span>
            {openTicketsCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-[#92400E]">
            View and reply to customer inquiries.
          </CardDescription>
        </div>
        <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
          <SelectTrigger className="w-48 bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] text-[#1F2937] font-medium">
            <SelectValue placeholder="All Inquiries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Inquiries</SelectItem>
            <SelectItem value="open">Needs Reply</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-6">
        <div className="rounded-xl border-2 border-[#F59E0B]/20 bg-white shadow-sm overflow-x-auto w-full">
          <Table className="w-full">
            <TableHeader className="bg-[#FEF7E0]/40 border-b border-[#F59E0B]/20">
              <TableRow>
                <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap w-24">Ticket #</TableHead>
                <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap max-w-[140px]">Customer</TableHead>
                <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 max-w-[180px]">Subject & Message</TableHead>
                <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap w-24">Status</TableHead>
                <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap w-20">Date</TableHead>
                <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap text-right w-28">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[#4B5563] font-medium">
                    No support tickets found. Messages submitted through /contact appear here automatically.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTickets.map((t) => (
                  <TableRow
                    key={t.id}
                    className="hover:bg-[#FEF7E0]/50 cursor-pointer"
                    onClick={() => {
                      setSelectedTicket(t)
                      setIsTicketModalOpen(true)
                    }}
                  >
                    <TableCell className="py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-[#92400E]">{t.ticket_number}</span>
                    </TableCell>
                    <TableCell className="py-3 max-w-[140px] whitespace-nowrap">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[#111827] text-sm truncate" title={t.name || "Customer"}>{t.name || "Customer"}</span>
                        <span className="text-xs text-[#4B5563] truncate" title={t.email}>{t.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 max-w-[160px] md:max-w-[200px]">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-[#111827] truncate" title={t.subject}>{t.subject}</span>
                        <span className="text-xs text-[#4B5563] truncate" title={t.message}>
                          {t.message ? (t.message.length > 30 ? `${t.message.slice(0, 30)}...` : t.message) : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          t.status === "open"
                            ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                            : t.status === "replied"
                            ? "bg-blue-100 text-blue-900 border-blue-300 font-bold"
                            : "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold"
                        }
                      >
                        {t.status === "open" ? "Needs Reply" : t.status === "replied" ? "Replied" : "Resolved"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 whitespace-nowrap">
                      <span className="text-xs text-[#4B5563] font-medium">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTicket(t)
                          setIsTicketModalOpen(true)
                        }}
                        className="h-8 px-2.5 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white text-xs flex items-center gap-1 font-semibold shadow-sm ml-auto"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        View & Reply
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Support Inbox Pagination */}
        {filteredTickets.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#F59E0B]/20 mt-4 text-xs text-[#92400E]">
            <div>
              Showing <span className="font-bold text-[#111827]">{(ticketsPage - 1) * pageSize + 1}</span> to{" "}
              <span className="font-bold text-[#111827]">{Math.min(ticketsPage * pageSize, filteredTickets.length)}</span> of{" "}
              <span className="font-bold text-[#111827]">{filteredTickets.length}</span> inquiries
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTicketsPage((p) => Math.max(1, p - 1))}
                disabled={ticketsPage === 1}
                className="h-8 px-2.5 text-xs text-[#92400E] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalTicketsPages }).map((_, i) => {
                  const pageNum = i + 1
                  if (
                    pageNum === 1 ||
                    pageNum === totalTicketsPages ||
                    (pageNum >= ticketsPage - 1 && pageNum <= ticketsPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setTicketsPage(pageNum)}
                        className={`h-8 min-w-8 px-2 rounded-md font-bold text-xs transition-colors ${
                          ticketsPage === pageNum
                            ? "bg-[#F59E0B] text-white shadow-xs"
                            : "text-[#92400E] hover:bg-[#FEF7E0]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  } else if (pageNum === ticketsPage - 2 || pageNum === ticketsPage + 2) {
                    return <span key={pageNum} className="text-[#92400E]/50 px-1">...</span>
                  }
                  return null
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTicketsPage((p) => Math.min(totalTicketsPages, p + 1))}
                disabled={ticketsPage === totalTicketsPages}
                className="h-8 px-2.5 text-xs text-[#92400E] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937]">
            {isSubAdmin ? "Support Inbox" : "Customers & Security"}
          </h1>
          <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5 leading-relaxed">
            {isSubAdmin
              ? "View and reply to customer inquiries submitted from the contact page."
              : "Manage customer accounts, view order history, handle security, and reply to support inquiries"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(false)}
          disabled={loading || refreshing}
          className="w-fit self-start sm:self-auto border-[#F59E0B] text-[#92400E] bg-[#FEF7E0] hover:bg-[#FEF7E0]/80 font-semibold shadow-xs h-9 px-3.5 text-xs sm:text-sm shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Main Content Area */}
      {isSubAdmin ? (
        <div className="space-y-5 sm:space-y-6 w-full min-w-0">{supportInboxCard}</div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5 sm:space-y-6 w-full min-w-0">
          {/* Scrollable Tabs on Mobile */}
          <div className="w-full overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex w-auto justify-start bg-[#FEF7E0]/70 border-2 border-[#F59E0B]/30 p-1 rounded-xl shadow-xs gap-1">
              <TabsTrigger
                value="customers"
                className="data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#92400E] hover:text-[#B45309] font-bold flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap shrink-0"
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Customers ({customers.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="blacklist"
                className="data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#92400E] hover:text-[#B45309] font-bold flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap shrink-0"
              >
                <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Security & Blacklist ({consolidatedBans.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="support"
                className="data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#92400E] hover:text-[#B45309] font-bold flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all relative whitespace-nowrap shrink-0"
              >
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>Support Inbox</span>
                {openTicketsCount > 0 && (
                  <span className="relative flex h-2 w-2 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: CUSTOMERS & GUEST BUYERS                                         */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <TabsContent value="customers" className="space-y-5 sm:space-y-6">
          {/* Statistics Grid: 2 cols on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl">
              <CardContent className="p-3 sm:p-5">
                <p className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider truncate">Total Customers</p>
                <p className="text-xl sm:text-2xl font-bold text-[#1F2937] mt-1">{customers.length}</p>
              </CardContent>
            </Card>

            <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl">
              <CardContent className="p-3 sm:p-5">
                <p className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider truncate">Registered Accounts</p>
                <p className="text-xl sm:text-2xl font-bold text-[#1F2937] mt-1">{registeredCount}</p>
              </CardContent>
            </Card>

            <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl">
              <CardContent className="p-3 sm:p-5">
                <p className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider truncate">Guest Accounts</p>
                <p className="text-xl sm:text-2xl font-bold text-[#1F2937] mt-1">{guestCount}</p>
              </CardContent>
            </Card>

            <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl">
              <CardContent className="p-3 sm:p-5">
                <p className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider truncate">Banned Customers</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{bannedCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Card with Search and Table */}
          <Card className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-[#1F2937] text-lg font-bold">Customer Directory ({filteredCustomers.length})</CardTitle>
                <CardDescription className="text-[#92400E]">
                  Click any customer to inspect order history or resend gift card codes
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Search & Filter */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by customer email or name..."
                    className="pl-10 bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] text-[#1F2937] placeholder:text-gray-400 text-sm"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>

                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger className="w-full md:w-52 bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] text-[#1F2937] font-medium text-sm">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="registered">Registered (Verified)</SelectItem>
                    <SelectItem value="unverified">Unverified Accounts</SelectItem>
                    <SelectItem value="guest">Guest Buyers Only</SelectItem>
                    <SelectItem value="banned">Banned Accounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customers Table */}
              <div className="rounded-xl border-2 border-[#F59E0B]/20 bg-white shadow-sm mt-2 overflow-x-auto w-full">
                <Table className="w-full min-w-[720px]">
                  <TableHeader className="bg-[#FEF7E0]/40 border-b-2 border-[#F59E0B]/20">
                    <TableRow>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Customer Email & Name</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Type</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Orders</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Total Spent</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Last Active</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-[#4B5563] font-medium">
                          No customers found matching your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCustomers.map((cust) => (
                        <TableRow
                          key={cust.email}
                          className="hover:bg-[#FEF7E0]/50 cursor-pointer transition-colors border-b border-gray-100"
                          onClick={() => handleViewCustomerOrders(cust)}
                        >
                          <TableCell className="py-3">
                            <div className="flex flex-col min-w-0 max-w-[200px] lg:max-w-[260px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium text-sm text-[#111827] truncate hover:text-[#F59E0B] transition-colors" title={cust.email}>
                                  {cust.email}
                                </span>
                                {cust.isGoogleUser && (
                                  <span
                                    title="Registered with Google"
                                    className="inline-flex items-center shrink-0 bg-white p-0.5 rounded-full border border-gray-200 shadow-2xs"
                                  >
                                    <GoogleIcon className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              {cust.isRegistered && cust.name && (
                                <span className="text-xs text-[#4B5563] font-medium truncate">
                                  {cust.name}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={
                                cust.isRegistered
                                  ? (cust.isEmailVerified !== false
                                      ? "bg-purple-100 text-purple-900 border-purple-300 font-semibold text-[11px]"
                                      : "bg-orange-100 text-orange-900 border-orange-300 font-semibold text-[11px]")
                                  : "bg-amber-100 text-amber-900 border-amber-300 font-semibold text-[11px]"
                              }
                            >
                              {cust.isRegistered
                                ? (cust.isEmailVerified !== false ? "Registered" : "Unverified")
                                : "Guest"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <span className="font-bold text-[#111827] text-sm">{cust.totalOrders}</span>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <span className="font-bold text-[#111827] text-sm">Rs. {cust.totalSpent.toLocaleString()}</span>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs text-[#111827] font-semibold">
                                {cust.lastOrderDate ? new Date(cust.lastOrderDate).toLocaleDateString() : (cust.createdAt ? new Date(cust.createdAt).toLocaleDateString() : "—")}
                              </span>
                              {cust.lastSignInAt ? (
                                <span className="text-[11px] text-[#92400E] font-medium" title={new Date(cust.lastSignInAt).toLocaleString()}>
                                  {new Date(cust.lastSignInAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            {cust.isBanned ? (
                              <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1 w-fit text-[11px] font-bold">
                                <Ban className="h-3 w-3" />
                                Banned
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-900 border-emerald-300 flex items-center gap-1 w-fit text-[11px] font-semibold">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewCustomerOrders(cust)}
                              className="h-8 px-3 text-xs border-[#F59E0B]/40 text-[#92400E] bg-white hover:bg-[#FEF7E0] font-semibold flex items-center gap-1.5 shadow-sm rounded-lg ml-auto"
                            >
                              <span>View Orders</span>
                              <ChevronRight className="h-3.5 w-3.5 text-[#F59E0B]" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {filteredCustomers.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#F59E0B]/20 mt-4 text-xs text-[#92400E]">
                  <div>
                    Showing <span className="font-bold text-[#111827]">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                    <span className="font-bold text-[#111827]">{Math.min(currentPage * pageSize, filteredCustomers.length)}</span> of{" "}
                    <span className="font-bold text-[#111827]">{filteredCustomers.length}</span> customers
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2.5 text-xs text-[#92400E] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-8 min-w-8 px-2 rounded-md font-bold text-xs transition-colors ${
                                currentPage === pageNum
                                  ? "bg-[#F59E0B] text-white shadow-xs"
                                  : "text-[#92400E] hover:bg-[#FEF7E0]"
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                          return <span key={pageNum} className="text-[#92400E]/50 px-1">...</span>
                        }
                        return null
                      })}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2.5 text-xs text-[#92400E] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: SECURITY & BLACKLIST (Consolidated by User / Rule)                */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <TabsContent value="blacklist" className="space-y-4 sm:space-y-6">
          <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md overflow-hidden">
            <CardHeader className="p-4 sm:px-6 sm:py-4 border-b border-[#F59E0B]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-[#1F2937] text-base sm:text-lg">Active Blacklist Rules ({consolidatedBans.length})</CardTitle>
                <CardDescription className="text-[#92400E] text-xs sm:text-sm">
                  Active security rules to automatically block suspicious users and orders.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setBanType("email")
                  setBanValue("")
                  setBanReason("")
                  setBanDuration("0")
                  setBanModalOpen(true)
                }}
                className="w-full sm:w-auto bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white flex items-center justify-center gap-1.5 font-semibold shadow-sm shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add Blacklist Rule
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search active blacklist by target user, reason, or admin..."
                    value={banSearch}
                    onChange={(e) => setBanSearch(e.target.value)}
                    className="pl-10 bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] text-[#1F2937] placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border-2 border-[#F59E0B]/20 bg-white shadow-sm overflow-x-auto w-full">
                <Table className="w-full min-w-[650px]">
                  <TableHeader className="bg-[#FEF7E0]/40 border-b border-[#F59E0B]/20">
                    <TableRow>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Banned User / Target</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5">Reason</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Duration / Expiry</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap">Date Added</TableHead>
                      <TableHead className="text-[#1F2937] font-bold text-xs uppercase tracking-wider py-3.5 whitespace-nowrap text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-[#4B5563] font-medium">
                          No active blacklist rules. Add a rule above to block malicious actors.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedBans.map((ban) => (
                        <TableRow key={ban.id} className="hover:bg-[#FEF7E0]/50 border-b border-gray-100">
                          <TableCell className="py-3.5 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {ban.type === "email" && (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold px-1.5 py-0">
                                    Email Account
                                  </Badge>
                                )}
                                {ban.type === "ip" && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold px-1.5 py-0">
                                    IP Address
                                  </Badge>
                                )}
                                {ban.type === "email_domain" && (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold px-1.5 py-0">
                                    Email Domain
                                  </Badge>
                                )}
                                {ban.type === "device_id" && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-bold px-1.5 py-0">
                                    Device ID
                                  </Badge>
                                )}
                                <span className="font-mono font-bold text-[#111827] text-sm">{ban.target}</span>
                              </div>
                              {ban.customerName && (
                                <span className="text-xs text-[#4B5563] font-medium">{ban.customerName}</span>
                              )}
                              {ban.associatedEmail && (
                                <span className="text-[11px] text-[#92400E] font-medium">
                                  Associated with: <span className="font-semibold text-[#111827]">{ban.associatedEmail}</span>
                                </span>
                              )}
                              {ban.linkedCustomers && ban.linkedCustomers.length > 0 && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                  <span className="text-[10px] text-amber-800 font-bold">Also blocks linked accounts:</span>
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {ban.linkedCustomers.map((email) => (
                                      <span key={email} className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 font-mono">
                                        {email}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 max-w-xs xl:max-w-md">
                            <span className="text-sm text-[#111827] font-medium truncate block" title={ban.reason}>
                              {ban.reason}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 whitespace-nowrap">
                            {ban.expires_at ? (
                              <span className="text-xs text-amber-900 font-bold flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                Until {new Date(ban.expires_at).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-xs text-red-700 font-bold">Permanent Ban</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5 whitespace-nowrap">
                            <span className="text-xs text-[#4B5563] font-medium">
                              {new Date(ban.created_at).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-3.5 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenUnban(ban)}
                              className="h-8 px-3 text-xs border-emerald-500 text-emerald-900 hover:bg-emerald-50 bg-white font-semibold flex items-center gap-1.5 shadow-sm rounded-lg ml-auto"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Lift Ban
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Blacklist Pagination */}
              {filteredBans.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#F59E0B]/20 mt-4 text-xs text-[#92400E]">
                  <div>
                    Showing <span className="font-bold text-[#111827]">{(blacklistPage - 1) * pageSize + 1}</span> to{" "}
                    <span className="font-bold text-[#111827]">{Math.min(blacklistPage * pageSize, filteredBans.length)}</span> of{" "}
                    <span className="font-bold text-[#111827]">{filteredBans.length}</span> blacklist rules
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBlacklistPage((p) => Math.max(1, p - 1))}
                      disabled={blacklistPage === 1}
                      className="h-8 px-2.5 text-xs text-[#92400E] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalBlacklistPages }).map((_, i) => {
                        const pageNum = i + 1
                        if (
                          pageNum === 1 ||
                          pageNum === totalBlacklistPages ||
                          (pageNum >= blacklistPage - 1 && pageNum <= blacklistPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setBlacklistPage(pageNum)}
                              className={`h-8 min-w-8 px-2 rounded-md font-bold text-xs transition-colors ${
                                blacklistPage === pageNum
                                  ? "bg-[#F59E0B] text-white shadow-xs"
                                  : "text-[#92400E] hover:bg-[#FEF7E0]"
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        } else if (pageNum === blacklistPage - 2 || pageNum === blacklistPage + 2) {
                          return <span key={pageNum} className="text-[#92400E]/50 px-1">...</span>
                        }
                        return null
                      })}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBlacklistPage((p) => Math.min(totalBlacklistPages, p + 1))}
                      disabled={blacklistPage === totalBlacklistPages}
                      className="h-8 px-2.5 text-xs text-[#92400E] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────────────────────────────────────────────────────────────────── */}
        {/* TAB 3: SUPPORT INBOX                                                    */}
        {/* ──────────────────────────────────────────────────────────────────────── */}
        <TabsContent value="support" className="space-y-6">
          {supportInboxCard}
        </TabsContent>
      </Tabs>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CUSTOMER PROFILE, QUICK ACTIONS & ORDER CODE RESEND               */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {!isSubAdmin && (
        <>
          <Dialog
        open={isCustomerModalOpen}
        onOpenChange={(open) => {
          setIsCustomerModalOpen(open)
          if (!open) {
            setTimeout(() => {
              setSelectedCustomer(null)
            }, 300)
          }
        }}
      >
        <DialogContent className="max-w-xl w-[94vw] sm:w-full bg-white max-h-[90vh] overflow-hidden p-0 rounded-2xl shadow-xl border-2 border-[#F59E0B]/30 flex flex-col">
          {selectedCustomer && (
            <div className="overflow-y-auto max-h-[90vh] p-4 sm:p-6 space-y-4">
              <DialogHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg sm:text-xl font-bold text-[#1F2937]">
                    Customer Details
                  </DialogTitle>
                </div>
              </DialogHeader>

              {/* Customer Profile & Quick Actions Banner */}
              <div className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 rounded-xl p-3.5 sm:p-5 mb-4 sm:mb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-[#111827] truncate">{selectedCustomer.name || "Customer"}</h2>
                      <Badge
                        variant="outline"
                        className={
                          selectedCustomer.isRegistered
                            ? "bg-purple-100 text-purple-900 border-purple-300 font-semibold text-xs"
                            : "bg-amber-100 text-amber-900 border-amber-300 font-semibold text-xs"
                        }
                      >
                        {selectedCustomer.isRegistered ? "Registered Customer" : "Guest Buyer"}
                      </Badge>
                      {selectedCustomer.isGoogleUser && (
                        <span
                          title="Registered with Google"
                          className="inline-flex items-center shrink-0 bg-white p-0.5 rounded-full border border-gray-200 shadow-2xs"
                        >
                          <GoogleIcon className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {selectedCustomer.isBanned && (
                        <Badge variant="destructive" className="bg-red-600 text-white font-bold text-xs">
                           Banned
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#4B5563] mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#111827]">{selectedCustomer.email}</span>
                      
                    </p>
                  </div>

                  {/* Quick Actions Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {selectedCustomer.isRegistered && Boolean(selectedCustomer.userId) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResetModalEmail(selectedCustomer.email)}
                        className="h-8 px-3 text-xs border-purple-300 text-purple-900 hover:bg-purple-50 bg-white font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-purple-700" />
                        <span>Reset Password</span>
                      </Button>
                    )}

                    {selectedCustomer.isBanned ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenUnbanForCustomer(selectedCustomer)}
                        className="h-8 px-3 text-xs border-emerald-500 text-emerald-900 hover:bg-emerald-50 bg-white font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Lift Ban</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenCustomerBan(selectedCustomer)}
                        className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50 bg-white font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
                      >
                        <Ban className="h-3.5 w-3.5 text-red-600" />
                        <span>Ban Customer</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Key Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#F59E0B]/20">
                  <div className="bg-white/90 rounded-lg p-2.5 border border-[#F59E0B]/20 shadow-xs">
                    <span className="text-[11px] text-[#92400E] font-medium block">Total Orders</span>
                    <span className="text-sm font-bold text-[#111827]">
                      {selectedCustomer.totalOrders} ({selectedCustomer.successfulOrders} paid · {selectedCustomer.failedOrders} failed)
                    </span>
                  </div>
                  <div className="bg-white/90 rounded-lg p-2.5 border border-[#F59E0B]/20 shadow-xs">
                    <span className="text-[11px] text-[#92400E] font-medium block">Lifetime Spend</span>
                    <span className="text-sm font-bold text-[#111827]">Rs. {selectedCustomer.totalSpent.toLocaleString()}</span>
                  </div>
                  <div className="bg-white/90 rounded-lg p-2.5 border border-[#F59E0B]/20 shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-[#92400E] font-medium block">Last Active</span>
                    <span className="text-sm font-bold text-[#111827]">
                      {selectedCustomer.lastOrderDate ? new Date(selectedCustomer.lastOrderDate).toLocaleDateString() : (selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString() : "—")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order History Section */}
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-[#F59E0B]" />
                    Order History ({customerOrders.length})
                  </h3>
                  <span className="text-xs text-[#92400E]">Click resend to deliver codes to customer email</span>
                </div>

                {loadingOrders ? (
                  <div className="text-center py-12 text-[#4B5563]">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#F59E0B]" />
                    <p className="text-sm font-medium">Loading customer orders...</p>
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[#4B5563] font-medium text-sm">No orders found for this customer.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerOrders
                      .slice((customerOrdersPage - 1) * ordersPageSize, customerOrdersPage * ordersPageSize)
                      .map((order) => (
                      <div
                        key={order.id}
                        className="border-2 border-[#F59E0B]/20 bg-white hover:border-[#F59E0B]/50 rounded-xl p-4 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        {/* Left: Order Details */}
                        <div className="space-y-1 flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-[#111827]">{order.transaction_id}</span>
                            <span className="text-xs text-gray-400 font-medium">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                ["Completed", "Paid"].includes(order.status)
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold text-[10px]"
                                  : ["Cancelled", "Payment Failed", "Failed"].includes(order.status)
                                  ? "bg-red-100 text-red-900 border-red-300 font-semibold text-[10px]"
                                  : "bg-amber-100 text-amber-900 border-amber-300 font-semibold text-[10px]"
                              }
                            >
                              {order.status}
                            </Badge>
                          </div>
                          <p className="font-semibold text-sm text-[#111827]">
                            {order.product_name} <span className="text-xs font-normal text-gray-500">({order.amount})</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Total: <span className="font-bold text-[#111827]">Rs. {order.price}</span> · Method: <span className="font-medium text-gray-700">{order.payment_method}</span>
                          </p>
                        </div>

                        {/* Right: Resend Button (No gift card code displayed beside it) */}
                        <div className="shrink-0">
                          {order.giftcard_code ? (
                            <Button
                              size="sm"
                              onClick={() => handleResendGiftcardCode(order.transaction_id)}
                              disabled={resendingCodeTxnId === order.transaction_id}
                              className="h-9 px-4 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all shrink-0"
                              title="Resend this gift card code directly to the customer's email"
                            >
                              {resendingCodeTxnId === order.transaction_id ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                                  <span>Sending...</span>
                                </>
                              ) : (
                                <>
                                  <SendHorizontal className="h-3.5 w-3.5 text-white" />
                                  <span>Resend Code</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium italic">Direct fulfillment</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Orders Pagination if > 10 */}
                    {customerOrders.length > ordersPageSize && (
                      <div className="flex items-center justify-between pt-3 border-t border-[#F59E0B]/20 text-xs text-[#92400E]">
                        <span>
                          Showing {(customerOrdersPage - 1) * ordersPageSize + 1}–{Math.min(customerOrdersPage * ordersPageSize, customerOrders.length)} of {customerOrders.length} orders
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCustomerOrdersPage((p) => Math.max(1, p - 1))}
                            disabled={customerOrdersPage === 1}
                            className="h-7 px-2.5 text-xs border-[#F59E0B]/30 hover:bg-[#FEF7E0] text-[#92400E] font-medium"
                          >
                            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                            Prev
                          </Button>
                          <span className="font-bold text-[#111827] px-1">
                            {customerOrdersPage} / {Math.ceil(customerOrders.length / ordersPageSize)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCustomerOrdersPage((p) => Math.min(Math.ceil(customerOrders.length / ordersPageSize), p + 1))}
                            disabled={customerOrdersPage === Math.ceil(customerOrders.length / ordersPageSize)}
                            className="h-7 px-2.5 text-xs border-[#F59E0B]/30 hover:bg-[#FEF7E0] text-[#92400E] font-medium"
                          >
                            Next
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: UNIFIED 1-CLICK CUSTOMER BAN                                      */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!customerToBan} onOpenChange={(open) => !open && setCustomerToBan(null)}>
        <DialogContent className="w-[94vw] sm:w-full sm:max-w-md bg-white border-2 border-red-200 shadow-2xl rounded-2xl p-4 sm:p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-red-600 text-lg font-bold">
              <Ban className="h-5 w-5" />
              Ban Customer
            </DialogTitle>
            <DialogDescription className="text-xs text-[#4B5563]">
              Suspend customer access across login, checkout, and future orders.
            </DialogDescription>
          </DialogHeader>

          {customerToBan && (
            <div className="space-y-4 py-3">
              <div className="flex items-center justify-between bg-red-50/50 p-3 rounded-xl border border-red-200/60">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Customer Email</p>
                  <p className="font-mono font-bold text-sm text-[#111827] truncate">{customerToBan.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant="outline"
                    className={
                      customerToBan.isRegistered
                        ? "bg-purple-100 text-purple-900 border-purple-300 text-xs font-bold shrink-0"
                        : "bg-amber-100 text-amber-900 border-amber-300 text-xs font-bold shrink-0"
                    }
                  >
                    {customerToBan.isRegistered ? "Registered User" : "Guest Buyer"}
                  </Badge>
                  {customerToBan.isGoogleUser && (
                    <span
                      title="Registered with Google"
                      className="inline-flex items-center shrink-0 bg-white p-0.5 rounded-full border border-gray-200 shadow-2xs"
                    >
                      <GoogleIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-[#1F2937]">Ban Duration</Label>
                <Select value={customerBanDuration} onValueChange={setCustomerBanDuration}>
                  <SelectTrigger className="w-full mt-1.5 border-2 border-[#F59E0B]/30 bg-white text-[#1F2937] font-medium text-sm focus:border-[#F59E0B]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Permanent Ban (Indefinite)</SelectItem>
                    <SelectItem value="720">30 Days (1 Month)</SelectItem>
                    <SelectItem value="168">7 Days (1 Week)</SelectItem>
                    <SelectItem value="24">24 Hours (1 Day)</SelectItem>
                    <SelectItem value="1">1 Hour</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#92400E] mt-1 font-medium">
                  {customerToBan.isRegistered 
                    ? "Suspends Supabase Auth account and blocks future checkouts."
                    : "Blocks guest checkouts and new registrations from this device."}
                </p>
              </div>

              <div>
                <Label className="text-xs font-bold text-[#1F2937]">Reason for Ban</Label>
                <Input
                  placeholder="e.g. Fraud, chargeback, policy violation"
                  value={customerBanReason}
                  onChange={(e) => setCustomerBanReason(e.target.value)}
                  className="mt-1.5 border-2 border-[#F59E0B]/30 bg-white text-[#1F2937] text-sm focus:border-[#F59E0B]"
                />
              </div>

              {/* Optional Advanced Ban Controls */}
              <div className="space-y-2.5 pt-3 border-t border-red-100">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Optional Ban Scope Controls
                </p>

                {/* Option 1: Ban IP address */}
                <div className="flex items-start gap-2.5 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                  <input
                    type="checkbox"
                    id="banCustomerIpCheckbox"
                    checked={customerBanIp}
                    onChange={(e) => setCustomerBanIp(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="banCustomerIpCheckbox" className="text-xs font-bold text-[#1F2937] cursor-pointer block">
                      Also ban IP address {customerToBan.lastIp ? `(${customerToBan.lastIp})` : ""}
                    </label>
                    <p className="text-[11px] text-[#92400E] leading-relaxed mt-0.5">
                      Nepal ISPs use CGNAT where multiple users share an IP. If enabled, other innocent users on this IP will be prompted with Cloudflare Turnstile verification.
                    </p>
                  </div>
                </div>

                {/* Option 2: Ban whole domain */}
                <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="banCustomerDomainCheckbox"
                    checked={customerBanDomain}
                    onChange={(e) => setCustomerBanDomain(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="banCustomerDomainCheckbox" className="text-xs font-bold text-[#1F2937] cursor-pointer block">
                      Ban whole email domain (@{customerToBan.email.split("@")[1]})
                    </label>
                    <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                      Blocks all existing and future customer accounts ending in @{customerToBan.email.split("@")[1]}. Recommended for burner/disposable domains.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setCustomerToBan(null)} className="w-full sm:w-auto border-gray-200 text-gray-700">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCustomerBan}
              disabled={submittingCustomerBan}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm flex items-center justify-center gap-1.5"
            >
              <Ban className="h-4 w-4" />
              {submittingCustomerBan ? "Banning..." : "Ban Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD MANUAL BAN (Device, IP, Email, Domain + Duration)             */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Dialog open={banModalOpen} onOpenChange={setBanModalOpen}>
        <DialogContent className="w-[94vw] sm:w-full sm:max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-lg font-bold">
              <ShieldAlert className="h-5 w-5" />
              Add Security Blacklist Rule
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Banned entities are immediately blocked from placing orders and checking out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Ban Target Type</Label>
              <Select value={banType} onValueChange={(val: any) => setBanType(val)}>
                <SelectTrigger className="w-full mt-1.5 border border-slate-200 text-slate-900 font-medium bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email Address</SelectItem>
                  <SelectItem value="ip">IP Address</SelectItem>
                  <SelectItem value="device_id">Browser Device ID (Anti-VPN Ban)</SelectItem>
                  <SelectItem value="email_domain">Email Domain Wildcard (e.g. meonvr.com)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {banType === "email"
                  ? "Email Address"
                  : banType === "ip"
                  ? "IP Address"
                  : banType === "device_id"
                  ? "Browser Device Token"
                  : "Domain Name (without @)"}
              </Label>
              <Input
                placeholder={
                  banType === "email"
                    ? "spammer@example.com"
                    : banType === "ip"
                    ? "103.xxx.xxx.xxx"
                    : banType === "device_id"
                    ? "d_abc123_xyz"
                    : "meonvr.com"
                }
                value={banValue}
                onChange={(e) => setBanValue(e.target.value)}
                className="mt-1.5 font-mono border border-slate-200 text-slate-900 placeholder:text-slate-400 bg-white"
              />
            </div>

            {/* Ban Duration Selector */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Ban Duration</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger className="w-full mt-1.5 border border-slate-200 text-slate-900 font-medium bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Hour (Temporary Timeout)</SelectItem>
                  <SelectItem value="24">24 Hours (1 Day Suspension)</SelectItem>
                  <SelectItem value="168">7 Days (1 Week Penalty)</SelectItem>
                  <SelectItem value="720">30 Days (1 Month Ban)</SelectItem>
                  <SelectItem value="0">Permanent Ban (Forever)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Reason for Ban</Label>
              <Input
                placeholder="e.g. Spamming unpaid orders, payment fraud, bot script"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="mt-1.5 border border-slate-200 text-slate-900 placeholder:text-slate-400 bg-white"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setBanModalOpen(false)} className="w-full sm:w-auto border-slate-200 text-slate-700">
              Cancel
            </Button>
            <Button
              onClick={handleCreateBan}
              disabled={submittingBan}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm justify-center"
            >
              {submittingBan ? "Applying Ban..." : "Confirm & Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: VIEW & REPLY TO SUPPORT TICKET                                    */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={isTicketModalOpen}
        onOpenChange={(open) => {
          setIsTicketModalOpen(open)
          if (!open) {
            setTimeout(() => {
              setSelectedTicket(null)
            }, 300)
          }
        }}
      >
        <DialogContent className="max-w-lg w-[94vw] sm:w-full bg-white max-h-[85vh] overflow-hidden p-0 border border-slate-200 shadow-2xl rounded-2xl flex flex-col">
          {selectedTicket && (
            <>
              <div
                className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#94A3B8 transparent" }}
              >
                <DialogHeader>
                  <div className="flex items-center justify-between pr-8">
                    <span className="font-mono text-xs font-bold text-[#7E3AF2]">
                      {selectedTicket.ticket_number}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        selectedTicket.status === "open"
                          ? "bg-amber-50 text-amber-800 border-amber-200 font-bold"
                          : "bg-blue-50 text-blue-800 border-blue-200 font-bold"
                      }
                    >
                      {selectedTicket.status.toUpperCase()}
                    </Badge>
                  </div>
                  <DialogTitle className="text-lg font-bold text-slate-900 mt-2">
                    {selectedTicket.subject}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500">
                    From <strong className="text-slate-900">{selectedTicket.name}</strong> ({selectedTicket.email}) on{" "}
                    {new Date(selectedTicket.created_at).toLocaleString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900">
                    <p className="font-bold text-xs text-slate-500 uppercase tracking-wide mb-1">Customer Message:</p>
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-900 font-medium max-h-48 overflow-y-auto">
                      {selectedTicket.message}
                    </p>
                  </div>

                  {/* Conversation Thread: Customer follow-ups & Admin replies */}
                  {((selectedTicket.replies && selectedTicket.replies.length > 0)
                    ? selectedTicket.replies
                    : (selectedTicket.last_reply
                        ? [{ reply: selectedTicket.last_reply, reply_by: selectedTicket.last_reply_by, replied_at: selectedTicket.replied_at, sender: "admin" as const }]
                        : [])
                  ).map((rep, idx, arr) => {
                    const isCustomer = rep.sender === "customer"
                    return (
                      <div
                        key={idx}
                        className={
                          isCustomer
                            ? "p-4 bg-amber-50/70 border-l-4 border-[#F59E0B] rounded-xl text-sm"
                            : "p-4 bg-purple-50/60 border-l-4 border-[#7E3AF2] rounded-xl text-sm"
                        }
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p
                            className={
                              isCustomer
                                ? "font-bold text-xs text-amber-900 uppercase tracking-wide"
                                : "font-bold text-xs text-purple-900 uppercase tracking-wide"
                            }
                          >
                            {isCustomer
                              ? `Customer Follow-up by ${rep.reply_by || selectedTicket.name}:`
                              : (arr.filter((r) => r.sender !== "customer").length > 1
                                  ? `Reply #${idx + 1} by `
                                  : "Reply by ") +
                                (rep.reply_by?.includes("@")
                                  ? (rep.reply_by.toLowerCase().includes("admin") ? "Nishant Nayak" : rep.reply_by.split("@")[0])
                                  : (rep.reply_by || "Nishant Nayak")) +
                                ":"}
                          </p>
                          {rep.replied_at && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              {new Date(rep.replied_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-slate-900 font-medium">{rep.reply}</p>
                      </div>
                    )
                  })}

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-900">
                      Send Official Email Response to Customer:
                    </Label>
                    <Textarea
                      placeholder="Type your response here... It will be delivered directly to the customer's email inbox with Byiora branding."
                      rows={3}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="border border-slate-200 focus:border-[#7E3AF2] text-slate-900 bg-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0">
                <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  {selectedTicket.status !== "resolved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkTicketStatus(selectedTicket.id, "resolved")}
                      className="text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-50 font-bold flex-1 sm:flex-initial"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                      Mark Resolved
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsTicketModalOpen(false)
                      setTimeout(() => setSelectedTicket(null), 300)
                    }}
                    className="text-xs text-slate-500 flex-1 sm:flex-initial"
                  >
                    Close
                  </Button>
                </div>

                <Button
                  onClick={handleSendTicketReply}
                  disabled={sendingReply || !replyMessage.trim()}
                  className="w-full sm:w-auto bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white flex items-center justify-center gap-1.5 font-bold shadow-sm"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendingReply ? "Sending Email..." : "Send Email Reply"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: PASSWORD RESET CONFIRMATION                                       */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {!isSubAdmin && (
        <Dialog open={!!resetModalEmail} onOpenChange={(open) => !open && setResetModalEmail(null)}>
          <DialogContent className="w-[94vw] sm:w-full sm:max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#7E3AF2] text-lg font-bold">
                <KeyRound className="h-5 w-5" />
                Send Password Reset Link
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Send a secure password reset link to <strong className="text-slate-900">{resetModalEmail}</strong>?
              </DialogDescription>
            </DialogHeader>

            <p className="text-xs text-slate-600 py-2 font-medium">
              This will immediately sign out all active sessions for this user, randomize their current password, and email them a secure 24-hour reset link to set a new password.
            </p>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setResetModalEmail(null)} className="w-full sm:w-auto border-slate-200 text-slate-700">
                Cancel
              </Button>
              <Button
                onClick={() => resetModalEmail && handleSendPasswordReset(resetModalEmail)}
                disabled={sendingReset}
                className="w-full sm:w-auto bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold shadow-sm justify-center"
              >
                {sendingReset ? "Sending Email..." : "Send Reset Email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: LIFT BAN CONFIRMATION                                             */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!unbanTarget} onOpenChange={(open) => !open && setUnbanTarget(null)}>
        <DialogContent className="w-[94vw] sm:w-full sm:max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 text-lg font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Lift Security Ban
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Restore full platform access for this user or security rule.
            </DialogDescription>
          </DialogHeader>

          {unbanTarget && (
            <div className="space-y-3 py-3">
              <div className="bg-[#FEF7E0] border-2 border-[#F59E0B]/30 rounded-xl p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-[#92400E] font-bold uppercase tracking-wider">
                    {unbanTarget.type === "ip"
                      ? "Banned IP Address"
                      : unbanTarget.type === "email_domain"
                      ? "Banned Domain Address"
                      : unbanTarget.type === "device_id"
                      ? "Banned Device ID"
                      : unbanTarget.isCustomerEmail
                      ? "Customer Account"
                      : "Blacklisted Target"}
                  </p>
                  <p className="font-bold text-sm text-[#111827] truncate mt-0.5" title={unbanTarget.target}>
                    {unbanTarget.target}
                  </p>
                  {unbanTarget.customerName && (
                    <p className="text-xs text-[#4B5563] font-medium truncate mt-0.5">
                      {unbanTarget.customerName}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] font-bold shrink-0"
                >
                  Active Ban
                </Badge>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Are you sure you want to lift the ban for <strong className="text-slate-900 font-semibold">{unbanTarget.target}</strong>?
                {unbanTarget.type === "ip" && (
                  <span className="block mt-1 text-slate-500 font-normal">
                    This will remove security restrictions and Turnstile requirements specifically for this IP address.
                  </span>
                )}
                {unbanTarget.type === "email_domain" && (
                  <span className="block mt-1 text-slate-500 font-normal">
                    This will allow customers with this email domain to purchase again.
                  </span>
                )}
              </p>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setUnbanTarget(null)}
              disabled={submittingUnban}
              className="w-full sm:w-auto border-slate-200 text-slate-700 font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUnban}
              disabled={submittingUnban}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm justify-center flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submittingUnban ? "Lifting Ban..." : "Confirm & Lift Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
