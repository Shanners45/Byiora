"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Search, Filter, RefreshCw, Download, Send, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { updateTransactionStatusAction, sendGiftcardCodeAction, insertNotificationAction } from "@/app/actions/orders"
import { getAllTransactionsAction } from "@/app/actions/dashboard"
import { decryptCheckoutData, clearCheckoutData } from "@/app/actions/checkout-encryption"
import { getAdminSessionAction, type AdminSession } from "@/app/actions/admin-utils"

interface Transaction {
  id: string
  product_name: string
  amount: string
  price: string
  status: "Completed" | "Failed" | "Processing" | "Payment Pending" | "Archived" | "Refunded" | "Cancelled" | "Paid" | "Payment Failed"
  payment_method: string
  transaction_id: string
  user_email: string
  created_at: string
  user_id?: string
  guest_user_data?: any
  is_guest?: boolean
  product_category?: string
  giftcard_code?: string
  failure_remarks?: string
  bank_txn_id?: string
  payment_category?: string
  users?: {
    id: string
    name: string
  } | null
  encrypted_checkout_data?: string | null
}

// Component to handle decryption and display of direct-login checkout data
function DirectLoginCell({ transaction }: { transaction: Transaction }) {
  const [decryptedData, setDecryptedData] = useState<Record<string, string> | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)

  const handleReveal = async () => {
    if (decryptedData) {
      setIsRevealed(!isRevealed)
      return
    }

    if (!transaction.encrypted_checkout_data) {
      toast.error("No encrypted data available")
      return
    }

    setIsDecrypting(true)
    try {
      const result = await decryptCheckoutData(transaction.encrypted_checkout_data)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDecryptedData(result.data || null)
      setIsRevealed(true)
    } catch (error) {
      toast.error("Failed to decrypt data")
    } finally {
      setIsDecrypting(false)
    }
  }

  if (!transaction.encrypted_checkout_data) {
    return <span className="text-gray-400 text-xs">Data cleared</span>
  }

  return (
    <div className="space-y-1.5">
      {isRevealed && decryptedData ? (
        <div className="space-y-1 bg-amber-50/80 border border-amber-200 rounded-md p-2">
          {Object.entries(decryptedData).map(([key, value]) => (
            <div key={key} className="text-xs">
              <span className="text-gray-500 capitalize font-medium">{key.replace(/_/g, " ")}:</span>{" "}
              <span className="font-mono font-semibold text-amber-900 break-all">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 font-medium px-2 py-1 rounded-md">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Encrypted
        </span>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleReveal}
        disabled={isDecrypting}
        className={`h-6 px-2.5 text-[10px] rounded-md ${isRevealed ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-purple-600 hover:text-purple-700 hover:bg-purple-50"}`}
      >
        {isDecrypting ? "..." : isRevealed ? <><EyeOff className="h-3 w-3 mr-1" />Hide</> : <><Eye className="h-3 w-3 mr-1" />Reveal</>}
      </Button>
    </div>
  )
}
export default function OrdersPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [adminUser, setAdminUser] = useState<Pick<AdminSession, "role"> | null>(null)
  const [giftcardCodes, setGiftcardCodes] = useState<Record<string, string>>({})
  const [sendingCodeIds, setSendingCodeIds] = useState<Record<string, boolean>>({})
  // Remarks dialog state
  const [remarksDialog, setRemarksDialog] = useState<{ open: boolean; transactionId: string; status: Transaction["status"] } | null>(null)
  const [remarksText, setRemarksText] = useState("")
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    ; (async () => {
      try {
        const session = await getAdminSessionAction()
        if (session.success) setAdminUser({ role: session.data.role })
      } catch (error) {
        console.error("Error loading admin session:", error)
      }
    })()
  }, [])

  const loadTransactions = async () => {
    try {
      setLoading(true)

      // Use Server Action with Service Role to bypass RLS
      const result = await getAllTransactionsAction()

      if (result.error) {
        toast.error(result.error)
        return
      }

      // Process transactions to identify guest vs registered users
      const processedTransactions = (result.data || []).map((transaction: any) => ({
        ...transaction,
        is_guest: !transaction.user_id,
      }))

      setTransactions(processedTransactions)
      setFilteredTransactions(processedTransactions)
    } catch (error) {
      console.error("Error loading transactions:", error)
      toast.error("Failed to load transactions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  useEffect(() => {
    let filtered = transactions

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (transaction) =>
          transaction.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((transaction) => transaction.status === statusFilter)
    }

    setFilteredTransactions(filtered)
    // Reset to first page when filters change
    setCurrentPage(1)
  }, [transactions, searchQuery, statusFilter])

  // Pagination logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800"
      case "Processing":
        return "bg-blue-100 text-blue-800"
      case "Failed":
        return "bg-red-100 text-red-800"
      case "Cancelled":
        return "bg-gray-100 text-gray-800"
      case "Payment Pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Paid":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "Payment Failed":
        return "bg-red-50 text-red-700 border-red-200"

      case "Archived":
        return "bg-gray-50 text-gray-400 border-gray-200"
      case "Refunded":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const sendOrderStatusNotification = async (transaction: Transaction, status: Transaction["status"], remarks?: string) => {
    try {
      // Send notification to user when order status is updated (registered users only)
      if (transaction.user_id) {
        const isCompleted = status === "Completed"
        const title = isCompleted ? "Order Completed! 🎉" : "Order Failed ⚠️"

        let message: string
        if (isCompleted) {
          message = `Your order for ${transaction.product_name} (${transaction.amount}) is complete! Please check your email or transaction history for your gift card code/details.`
        } else {
          const remarksText = remarks?.trim() ? remarks : "No specific reason provided"
          message = `Your order for ${transaction.product_name} (${transaction.amount}) could not be processed.\n\nReason: ${remarksText}\n\nPlease contact support if you need assistance.`
        }

        // Use server action with service role to bypass RLS
        await insertNotificationAction(
          title,
          message,
          isCompleted ? "success" : "error",
          transaction.user_id
        )
      }
    } catch (error) {
      console.error("Error sending order status notification:", error)
    }
  }

  const updateTransactionStatus = async (transactionId: string, newStatus: Transaction["status"], remarks?: string) => {

    // If marking as failed, prompt for remarks (optional)
    if (newStatus === "Failed" && !remarks && !remarksDialog) {
      setRemarksText("")
      setRemarksDialog({ open: true, transactionId, status: newStatus })
      return
    }

    try {
      const transaction = transactions.find((t) => t.transaction_id === transactionId)
      const oldStatus = transaction?.status

      // Use Server Action with Service Role to bypass RLS
      const result = await updateTransactionStatusAction(transactionId, newStatus, remarks)

      if (result.error) {
        toast.error(result.error)
        return
      }

      const actualNewStatus = result.finalStatus || newStatus

      // Update local state
      setTransactions((prev) => prev.map((t) => {
        if (t.transaction_id === transactionId) {
          return { 
            ...t, 
            status: actualNewStatus, 
            failure_remarks: remarks,
            ...(result.giftcardCode ? { giftcard_code: result.giftcardCode } : {})
          }
        }
        return t;
      }))

      // Send notification if order status is updated to Completed or Failed
      if ((actualNewStatus === "Completed" || actualNewStatus === "Failed") && oldStatus !== actualNewStatus && transaction) {
        await sendOrderStatusNotification(transaction, actualNewStatus, remarks)
      }

      // Send Order Status Email for Completed, Failed, or (Payment Failed for nepalpay/fonepay)
      // Skip if the action already sent an email (e.g. auto-fulfilled with giftcard code)
      const isPaymentFailedEmail = actualNewStatus === "Payment Failed" && (transaction?.payment_category === "nepalpay" || transaction?.payment_category === "fonepay");
      if (!result.emailSent && transaction && (actualNewStatus === "Completed" || actualNewStatus === "Failed" || isPaymentFailedEmail) && actualNewStatus !== oldStatus) {
        try {
          await fetch('/api/send-order-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: transaction.user_email,
              userName: transaction.users?.name || transaction.guest_user_data?.name || transaction.user_email.split('@')[0],
              productName: transaction.product_name,
              denomination: transaction.amount,
              status: actualNewStatus,
              transactionId: transaction.transaction_id,
              remarks: remarks || undefined,
              isGuest: !transaction.user_id,
              isDynamic: transaction.payment_category === "nepalpay" || transaction.payment_category === "fonepay"
            })
          })
        } catch (e) {
          console.error("Failed to send order status email:", e)
        }
      }

      // Auto-clear encrypted checkout data when marking as completed or failed
      if ((newStatus === "Completed" || newStatus === "Failed") && transaction?.encrypted_checkout_data) {
        try {
          await clearCheckoutData(transactionId)
          // Update local state to clear the encrypted data
          setTransactions((prev) => prev.map((t) => (
            t.transaction_id === transactionId ? { ...t, encrypted_checkout_data: null } : t
          )))
        } catch (clearError) {
          console.error("Failed to clear checkout data:", clearError)
        }
      }

      toast.success("Transaction status updated successfully")
    } catch (error) {
      console.error("Error updating transaction status:", error)
      toast.error("Failed to update status")
    }
  }

  const handleSendGiftcardCode = async (transaction: Transaction) => {
    const code = giftcardCodes[transaction.id] || transaction.giftcard_code
    if (!code) {
      toast.error("Please enter a giftcard code before sending")
      return
    }

    setSendingCodeIds((prev) => ({ ...prev, [transaction.id]: true }))
    try {
      // Use Server Action with Service Role to bypass RLS
      const result = await sendGiftcardCodeAction(transaction.transaction_id, code)

      if (result.error) {
        throw new Error(result.error)
      }

      // Update local state
      setTransactions((prev) =>
        prev.map((t) => (t.id === transaction.id ? { ...t, giftcard_code: code, status: "Completed" } : t))
      )

      // Send combined completion + giftcode email
      const response = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: transaction.user_email,
          userName: transaction.users?.name,
          productName: transaction.product_name,
          denomination: transaction.amount,
          giftcardCode: code,
          transactionId: transaction.transaction_id,
          subject: `Your ${transaction.product_name} Giftcard Code from Byiora`,
          isCompletionEmail: true
        })
      })

      const emailResult = await response.json()
      if (!response.ok) throw new Error(emailResult.error || 'Failed to send')

      // Notification is already sent by updateTransactionStatus when status changes to Completed.
      // The giftcode email from /api/send-code serves as the primary delivery mechanism.

      toast.success("Order marked as completed and email sent with giftcode!")
    } catch (error: any) {
      console.error("Error sending code:", error)
      toast.error(error.message || "Failed to process giftcard code")
    } finally {
      setSendingCodeIds((prev) => ({ ...prev, [transaction.id]: false }))
    }
  }

  const getUIDForDisplay = (transaction: Transaction) => {
    // For topup products, UID comes from guest_user_data
    if (transaction.product_name.toLowerCase().includes("topup") || transaction.product_category === "topup") {
      const uid = transaction.guest_user_data?.userId || transaction.guest_user_data?.uid;
      const server = transaction.guest_user_data?.server;
      if (uid) {
        return server ? `UID: ${uid} | Server: ${server}` : `UID: ${uid}`
      }
    }
    // For direct-login products, show "Direct Login" label
    if (transaction.product_category === "direct-login") {
      return "Direct Login"
    }
    // For digital-goods, show giftcard code if available
    if (transaction.product_category === "digital-goods" || (!transaction.product_category && transaction.product_name)) {
      if (transaction.giftcard_code) {
        return transaction.giftcard_code
      }
    }
    return "N/A"
  }

  // Proper CSV formatting helper
  const formatCSVField = (field: any) => {
    const stringField = String(field || "").replace(/"/g, '""')
    return `"${stringField}"`
  }

  const exportTransactions = () => {
    const headers = ["Order ID", "Product", "Amount", "Price", "Status", "Payment Method", "Customer", "Type", "UID", "Date"]

    const rows = filteredTransactions.map((t) => [
      t.transaction_id,
      t.product_name,
      t.amount,
      `Rs. ${t.price}`,
      t.status,
      t.payment_method,
      t.user_email,
      t.is_guest ? "Guest" : "Registered",
      getUIDForDisplay(t),
      new Date(t.created_at).toLocaleDateString(),
    ])

    const csvContent = [
      headers.map(formatCSVField).join(","),
      ...rows.map(row => row.map(formatCSVField).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
            <p className="text-[#4B5563]">Loading transactions...</p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate orders by user type
  const registeredUserOrders = filteredTransactions.filter(t => !t.is_guest && t.user_id).length
  const guestUserOrders = filteredTransactions.filter(t => t.is_guest).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Orders</h1>
          <p className="text-[#4B5563]">Manage all customer transactions and orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadTransactions}
            disabled={loading}
            className="border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportTransactions}
            className="border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Order Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Total Orders</p>
                <p className="text-2xl font-bold text-[#1F2937]">{filteredTransactions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Registered Users</p>
                <p className="text-2xl font-bold text-[#1F2937]">{registeredUserOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Guest Users</p>
                <p className="text-2xl font-bold text-[#1F2937]">{guestUserOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
        <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937]">All Transactions ({filteredTransactions.length})</CardTitle>
          <CardDescription className="text-[#92400E]">Complete order history from Supabase database</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by product, email, or order ID..."
                className="pl-10 bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="Payment Pending">Payment Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Refunded">Refunded</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-x-auto">
            <Table>
              <TableHeader className="bg-white">
                <TableRow>
                  <TableHead className="text-[#1F2937] font-medium">Order ID</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Bank Txn ID</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Product</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Price</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Customer</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Status</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">UID / Giftcode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-[#FEF7E0]/50">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm text-[#4B5563]">{transaction.transaction_id}</span>
                        <span className="text-xs text-gray-400">{new Date(transaction.created_at).toLocaleDateString()}</span>
                        <span className="text-xs text-gray-400">{new Date(transaction.created_at).toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit", hour12: true })} NPT</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {transaction.bank_txn_id ? (
                        <span className="font-mono text-sm text-[#4B5563]">{transaction.bank_txn_id}</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[#1F2937]">{transaction.product_name}</span>
                        <span className="text-xs text-[#4B5563]">{transaction.amount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#1F2937] font-medium">Rs. {transaction.price}</span>
                        <span className="text-xs text-[#4B5563]">{transaction.payment_method}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-[#4B5563] text-sm">{transaction.user_email}</span>
                        <Badge variant={transaction.is_guest ? "secondary" : "default"} className="w-fit text-[10px] px-1.5 py-0 text-white">
                          {transaction.is_guest ? "Guest" : "Registered"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isDynamic =
                          transaction.payment_category === "nepalpay" ||
                          transaction.payment_category === "fonepay" ||
                          transaction.payment_method?.toLowerCase().includes("nepalpay") ||
                          transaction.payment_method?.toLowerCase().includes("fonepay")

                        if (isDynamic && transaction.status !== "Paid") {
                          return <Badge className={`${getStatusColor(transaction.status)} whitespace-nowrap w-fit`}>{transaction.status}</Badge>
                        }

                        return (
                          <Select
                            value={transaction.status}
                            onValueChange={(value) =>
                              updateTransactionStatus(transaction.transaction_id, value as Transaction["status"])
                            }
                          >
                            <SelectTrigger className="w-[140px] h-9 p-1 flex justify-between items-center">
                              <Badge className={`${getStatusColor(transaction.status)} whitespace-nowrap w-full justify-center`}>{transaction.status}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {isDynamic ? (
                                <>
                                  <SelectItem value={transaction.status}>{transaction.status}</SelectItem>
                                  <SelectItem value="Refunded">Refunded</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="Processing">Processing</SelectItem>
                                  <SelectItem value="Completed">Completed</SelectItem>
                                  <SelectItem value="Failed">Failed</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-[#4B5563] text-sm">
                      {transaction.product_category === "direct-login" ? (
                        <DirectLoginCell transaction={transaction} />
                      ) : transaction.product_category === "topup" ? (
                        transaction.encrypted_checkout_data ? (
                          <DirectLoginCell transaction={transaction} />
                        ) : (
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-pre-wrap">{getUIDForDisplay(transaction)}</span>
                        )
                      ) : (transaction.product_category === "digital-goods" || transaction.product_category === "games" || (!transaction.product_category && transaction.product_name)) ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            placeholder="Enter Giftcard Code"
                            value={giftcardCodes[transaction.id] !== undefined ? giftcardCodes[transaction.id] : (transaction.giftcard_code || '')}
                            onChange={(e) => setGiftcardCodes(prev => ({ ...prev, [transaction.id]: e.target.value }))}
                            disabled={["Failed", "Completed", "Payment Failed", "Payment Pending"].includes(transaction.status)}
                            readOnly={transaction.status === "Completed"}
                            className={`w-[170px] h-8 text-xs placeholder:text-gray-500 ${transaction.status === "Completed" ? "bg-green-50 border-green-200 text-green-800 font-mono" : ""}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSendGiftcardCode(transaction)}
                            disabled={["Failed", "Completed", "Payment Failed", "Payment Pending"].includes(transaction.status) || sendingCodeIds[transaction.id]}
                            className={`h-8 px-2 flex-shrink-0 ${transaction.status === "Completed" ? "bg-green-500 hover:bg-green-500 text-white cursor-not-allowed" : "bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white"}`}
                          >
                            {sendingCodeIds[transaction.id] ? "..." : (transaction.status === "Completed" ? "✓" : <Send className="h-3 w-3" />)}
                          </Button>
                        </div>
                      ) : (
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{getUIDForDisplay(transaction)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-[#4B5563]">
                      {searchQuery || statusFilter !== "all"
                        ? "No transactions found matching your filters."
                        : "No transactions available."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-[#4B5563]">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} orders
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === totalPages || Math.abs(currentPage - page) <= 1)
                    .reduce((acc: (number | string)[], page) => {
                      if (acc.length > 0 && typeof acc[acc.length - 1] === "number" && (acc[acc.length - 1] as number) < page - 1) {
                        acc.push("...");
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((page, index) => (
                      page === "..." ? (
                        <span key={`ellipsis-${index}`} className="px-2 text-gray-500 text-sm">...</span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page as number)}
                          className={currentPage === page
                            ? "bg-[#6B3FA0] hover:bg-[#5A3586] text-white"
                            : "border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]"
                          }
                        >
                          {page}
                        </Button>
                      )
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remarks Dialog for Failed orders */}
      {remarksDialog && (
        <Dialog open={remarksDialog.open} onOpenChange={(open) => { if (!open) setRemarksDialog(null) }}>
          <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-red-600">Mark Order as Failed</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-500">Optionally add a reason for the failure. This will be included in the notification email sent to the customer.</p>
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">Remarks (Optional)</Label>
                <Textarea
                  placeholder="e.g. Payment not received, Out of stock, Invalid user ID..."
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value)}
                  className="resize-none placeholder:text-gray-500"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRemarksDialog(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  const { transactionId, status } = remarksDialog
                  setRemarksDialog(null)
                  updateTransactionStatus(transactionId, status, remarksText || "")
                }}
              >
                Confirm & Notify Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
