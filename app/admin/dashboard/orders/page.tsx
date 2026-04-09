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
import { Search, Filter, RefreshCw, Download, Send, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { updateTransactionStatusAction, sendGiftcardCodeAction, insertNotificationAction } from "@/app/actions/orders"
import { getAllTransactionsAction } from "@/app/actions/dashboard"

interface Transaction {
  id: string
  product_name: string
  amount: string
  price: string
  status: "Completed" | "Failed" | "Processing"
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
  users?: {
    id: string
    name: string
  } | null
}

export default function OrdersPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [adminUser, setAdminUser] = useState<{ role: string } | null>(null)
  const [giftcardCodes, setGiftcardCodes] = useState<Record<string, string>>({})
  const [sendingCodeIds, setSendingCodeIds] = useState<Record<string, boolean>>({})
  // Remarks dialog state
  const [remarksDialog, setRemarksDialog] = useState<{ open: boolean; transactionId: string; status: Transaction["status"] } | null>(null)
  const [remarksText, setRemarksText] = useState("")
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    const storedSession = localStorage.getItem("byiora_admin_session")
    if (storedSession) {
      try {
        const parsedUser = JSON.parse(storedSession)
        setAdminUser(parsedUser)
      } catch (error) {
        console.error("Error parsing admin session:", error)
      }
    }
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
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const sendOrderStatusNotification = async (transaction: Transaction, status: Transaction["status"], remarks?: string) => {
    try {
      // Send notification to user when order status is updated
      if (transaction.user_id) {
        const isCompleted = status === "Completed"
        const title = isCompleted ? "Order Completed! 🎉" : "Order Failed ⚠️"
        
        let message: string
        if (isCompleted) {
          message = `Your order for ${transaction.product_name} (${transaction.amount}) is complete! Please check your email for your gift card code/details and visit your transaction history for more information.`
        } else {
          const remarksText = remarks?.trim() ? remarks : "No specific reason provided"
          message = `Your order for ${transaction.product_name} (${transaction.amount}) could not be processed.\n\nReason: ${remarksText}\n\nPlease check your transaction history for details or contact support if you need assistance.`
        }

        await supabase.from("notifications").insert([
          {
            title,
            message,
            type: isCompleted ? "success" : "error",
            user_id: transaction.user_id,
            is_read: false,
          },
        ])
      }
    } catch (error) {
      console.error("Error sending order status notification:", error)
    }
  }

  const updateTransactionStatus = async (transactionId: string, newStatus: Transaction["status"], remarks?: string) => {
    // Check permissions
    if (adminUser?.role === "order_management") {
      toast.error("You don't have permission to update order status")
      return
    }

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

      // Update local state
      setTransactions((prev) => prev.map((t) => (t.transaction_id === transactionId ? { ...t, status: newStatus, failure_remarks: remarks } : t)))

      // Send notification if order is marked as completed
      // Send notification if order status is updated to Completed or Failed
      if ((newStatus === "Completed" || newStatus === "Failed") && oldStatus !== newStatus && transaction) {
        await sendOrderStatusNotification(transaction, newStatus, remarks)
      }

      // Send Order Status Email for Completed or Failed changes
      if (transaction && (newStatus === "Completed" || newStatus === "Failed") && newStatus !== oldStatus) {
        try {
          await fetch('/api/send-order-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: transaction.user_email,
              userName: transaction.users?.name,
              productName: transaction.product_name,
              denomination: transaction.amount,
              status: newStatus,
              transactionId: transaction.transaction_id,
              remarks: remarks || undefined,
            })
          })
        } catch (e) {
          console.error("Failed to send order status email:", e)
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
      const result = await sendGiftcardCodeAction(transaction.id, code)

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

      // Send notification to user if they have a user_id
      if (transaction.user_id) {
        const notifResult = await insertNotificationAction(
          "Order Completed! 🎉",
          `Your order for ${transaction.product_name} (${transaction.amount}) is complete! Please check your email for your gift card code.`,
          "success",
          transaction.user_id
        )
        if (notifResult.error) {
          console.error("Error inserting notification:", notifResult.error)
        } else {
          console.log("Notification sent successfully to user:", transaction.user_id)
        }
      } else {
        console.log("No user_id for transaction, skipping notification:", transaction.transaction_id)
      }

      toast.success("Order marked as completed and email sent with giftcode!")
    } catch (error: any) {
      console.error("Error sending code:", error)
      toast.error(error.message || "Failed to process giftcard code")
    } finally {
      setSendingCodeIds((prev) => ({ ...prev, [transaction.id]: false }))
    }
  }

  const getUIDForDisplay = (transaction: Transaction) => {
    // Check if it's a topup product
    if (transaction.product_name.toLowerCase().includes("topup") || transaction.product_category === "topup") {
      // guest_user_data contains { userId: "..." } for topup orders
      if (transaction.guest_user_data?.userId) {
        return transaction.guest_user_data.userId
      } else if (transaction.guest_user_data?.uid) {
        return transaction.guest_user_data.uid
      } else if (transaction.users?.id) {
        return transaction.users.id
      } else if (transaction.user_id) {
        return transaction.user_id
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
    const headers = ["Transaction ID", "Product", "Amount", "Price", "Status", "Payment Method", "Customer", "Type", "UID", "Date"]

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

  // Calculate unique users
  const uniqueRegisteredUsers = new Set(filteredTransactions.filter(t => !t.is_guest && t.user_id).map(t => t.user_id)).size
  const uniqueGuestUsers = new Set(filteredTransactions.filter(t => t.is_guest).map(t => t.user_email)).size

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
                <p className="text-2xl font-bold text-[#1F2937]">{uniqueRegisteredUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#92400E]">Guest Users</p>
                <p className="text-2xl font-bold text-[#1F2937]">{uniqueGuestUsers}</p>
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
                placeholder="Search by product, email, or transaction ID..."
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
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-hidden">
            <Table>
              <TableHeader className="bg-white">
                <TableRow>
                  <TableHead className="text-[#1F2937] font-medium">Transaction ID</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Product</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Amount</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Price</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Customer</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Type</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Payment</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Status</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Date</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">UID / Giftcode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-[#FEF7E0]/50">
                    <TableCell className="font-mono text-sm text-[#4B5563]">{transaction.transaction_id}</TableCell>
                    <TableCell className="font-medium text-[#1F2937]">{transaction.product_name}</TableCell>
                    <TableCell className="text-[#4B5563]">{transaction.amount}</TableCell>
                    <TableCell className="text-[#4B5563]">Rs. {transaction.price}</TableCell>
                    <TableCell className="text-[#4B5563]">{transaction.user_email}</TableCell>
                    <TableCell>
                      <Badge variant={transaction.is_guest ? "secondary" : "default"}>
                        {transaction.is_guest ? "Guest" : "Registered"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#4B5563]">{transaction.payment_method}</TableCell>
                    <TableCell>
                      {adminUser?.role === "order_management" ? (
                        <Badge className={getStatusColor(transaction.status)}>{transaction.status}</Badge>
                      ) : (
                        <Select
                          value={transaction.status}
                          onValueChange={(value) =>
                            updateTransactionStatus(transaction.transaction_id, value as Transaction["status"])
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <Badge className={getStatusColor(transaction.status)}>{transaction.status}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Processing">Processing</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-[#4B5563]">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-[#4B5563] text-sm">
                      {(transaction.product_category === "digital-goods" || (!transaction.product_category && transaction.product_name)) ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            placeholder="Enter Giftcard Code"
                            value={giftcardCodes[transaction.id] !== undefined ? giftcardCodes[transaction.id] : (transaction.giftcard_code || '')}
                            onChange={(e) => setGiftcardCodes(prev => ({ ...prev, [transaction.id]: e.target.value }))}
                            disabled={transaction.status === "Failed"}
                            className="w-[170px] h-8 text-xs placeholder:text-gray-500"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSendGiftcardCode(transaction)}
                            disabled={transaction.status === "Failed" || sendingCodeIds[transaction.id]}
                            className="h-8 px-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white flex-shrink-0"
                          >
                            {sendingCodeIds[transaction.id] ? "..." : <Send className="h-3 w-3" />}
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
                    <TableCell colSpan={10} className="h-24 text-center text-[#4B5563]">
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
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#F59E0B]/20">
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page 
                        ? "bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" 
                        : "border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]"
                      }
                    >
                      {page}
                    </Button>
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
          <DialogContent className="sm:max-w-md">
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
