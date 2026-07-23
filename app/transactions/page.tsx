"use client";

import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, Filter, Download, Lock, Eye, EyeOff, Gift, RefreshCw, RefreshCcw, Phone, CheckCircle2, ExternalLink } from "lucide-react";
import TransactionsLoading from "./loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { reorderTransactionAction, retryKhaltiPaymentAction } from "@/app/actions/transactions";
import { verifyPaymentByPhoneAction } from "@/app/actions/checkout";
import { TurnstileWidget } from "@/components/turnstile-widget";

export default function TransactionsPage() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  
  // Phone verification state
  const [verifyingPhoneId, setVerifyingPhoneId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);

  const router = useRouter();
  const { isLoggedIn, transactions, user, isLoading, refreshTransactions } = useAuth();

  // Show success toast when redirected from /checkout after payment completion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "success") {
      toast.success("Payment received! Your order is now visible below.");
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      refreshTransactions();
    }
  }, [refreshTransactions]);

  // Removed automatic redirect so users can see the "Sign In Required" message

  const filteredTransactions = transactions.filter(transaction => {
    if (filterStatus === "all") return true;
    const status = transaction.status.toLowerCase();
    
    if (filterStatus === "pending") {
      return ["processing", "payment pending", "paid"].includes(status);
    }
    if (filterStatus === "completed") {
      return ["completed"].includes(status);
    }
    if (filterStatus === "failed") {
      return ["failed", "payment failed", "cancelled"].includes(status);
    }
    return false;
  });

  const getNormalizedStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "processing":
        return "Awaiting Confirmation";
      case "payment pending":
        return "Awaiting Payment";
      case "paid":
        return "Payment Received";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "payment failed":
        return "Payment Not Received";
      case "cancelled":
        return "Cancelled";
      case "refunded":
        return "Refunded";
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    const label = getNormalizedStatusText(status);
    switch (status.toLowerCase()) {
      case "processing":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{label}</Badge>;
      case "payment pending":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{label}</Badge>;
      case "paid":
        return <Badge className="bg-green-100 text-green-800 border-green-200">{label}</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-white">{label}</Badge>;
      case "failed":
      case "payment failed":
        return <Badge variant="destructive">{label}</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{label}</Badge>;
      case "refunded":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">{label}</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  };

  const [retryingKhaltiId, setRetryingKhaltiId] = useState<string | null>(null);

  const handleReorder = async (oldTransactionId: string) => {
    setReorderingId(oldTransactionId);
    try {
      const res = await reorderTransactionAction(oldTransactionId);
      if (res.success && res.transactionId) {
        toast.success("Processing reorder... taking you to checkout");
        router.push(`/checkout/${res.transactionId}`);
      } else {
        toast.error(res.error || "Failed to process reorder");
      }
    } catch (e) {
      toast.error("An unexpected error occurred");
    } finally {
      setReorderingId(null);
    }
  };

  const handleRetryKhalti = async (transactionId: string) => {
    setRetryingKhaltiId(transactionId);
    try {
      const res = await retryKhaltiPaymentAction(transactionId);
      if (res.success && res.paymentUrl) {
        toast.info("Redirecting to Khalti payment gateway...");
        window.location.href = res.paymentUrl;
      } else {
        toast.error(res.error || "Failed to initiate Khalti payment");
      }
    } catch (e: any) {
      toast.error(e.message || "An unexpected error occurred");
    } finally {
      setRetryingKhaltiId(null);
    }
  };

  const [captchaToken, setCaptchaToken] = useState("");

  const handleVerifyPhone = async (transactionId: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith("9")) {
      toast.error("Please enter a valid 10-digit phone number starting with 9");
      return;
    }
    if (!captchaToken) {
      toast.error("Please complete the security check");
      return;
    }

    setIsPhoneVerifying(true);
    try {
      const res = await verifyPaymentByPhoneAction(transactionId, cleanPhone, captchaToken);
      if (res.success) {
        toast.success("Payment verified successfully! Your order is being fulfilled.");
        setVerifyingPhoneId(null);
        setPhoneNumber("");
        setCaptchaToken("");
        await refreshTransactions();
      } else {
        toast.error(res.error || "Verification failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setIsPhoneVerifying(false);
    }
  };

  const handleDownloadReceipt = async (transactionId: string) => {
    const transaction = transactions.find(t => t.transactionId === transactionId);
    if (!transaction) return;

    try {
      // Dynamic imports with proper error handling
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // 1. Header Section
      // Logo text fallback
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(126, 58, 242); // Brand purple color
      doc.text("BYIORA", 20, 25);

      // Try to add logo image
      try {
        const logoUrl = '/logo-final.png';
        const response = await fetch(logoUrl);
        if (response.ok) {
          const blob = await response.blob();
          const base64Logo = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          if (base64Logo.startsWith('data:image')) {
            doc.addImage(base64Logo, 'PNG', 20, 12, 40, 15);
            // Draw a white rectangle over the "BYIORA" text we drew earlier if logo exists
            doc.setFillColor(255, 255, 255);
            doc.rect(19, 19, 52, 10, 'F');
            // Re-draw logo to be on top
            doc.addImage(base64Logo, 'PNG', 20, 12, 40, 15);
          }
        }
      } catch (e) {
        console.warn("Logo fetch/process failed, using text fallback:", e);
      }

      // "PAID" Stamp
      doc.setDrawColor(34, 197, 94); // Green
      doc.setLineWidth(1);
      doc.roundedRect(pageWidth - 55, 15, 35, 15, 2, 2, 'S');
      doc.setFontSize(14);
      doc.setTextColor(34, 197, 94);
      doc.text("PAID", pageWidth - 37.5, 25, { align: "center" });

      // 2. Metadata Grid
      doc.setTextColor(75, 85, 99); // Slate-600
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const gridY = 45;
      const col1 = 20;
      const col2 = pageWidth / 2;

      doc.text("Order ID:", col1, gridY);
      doc.setFont("helvetica", "bold");
      doc.text(transaction.transactionId || "N/A", col1, gridY + 5);

      doc.setFont("helvetica", "normal");
      doc.text("Date:", col2, gridY);
      doc.setFont("helvetica", "bold");
      const dateVal = transaction.date || new Date().toISOString();
      const dateStr = new Date(dateVal).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(dateStr, col2, gridY + 5);

      doc.setFont("helvetica", "normal");
      doc.text("Payment Method:", col1, gridY + 15);
      doc.setFont("helvetica", "bold");
      doc.text(transaction.paymentMethod || "N/A", col1, gridY + 20);

      doc.setFont("helvetica", "normal");
      doc.text("Status:", col2, gridY + 15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text("Completed", col2, gridY + 20);

      // --- New Customer Section ---
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      doc.text("Customer Email:", col1, gridY + 30);
      doc.setFont("helvetica", "bold");
      doc.text(transaction.email || "N/A", col1, gridY + 35);

      if (user?.name) {
        doc.setFont("helvetica", "normal");
        doc.text("Customer Name:", col2, gridY + 30);
        doc.setFont("helvetica", "bold");
        doc.text(user.name, col2, gridY + 35);
      }

      // Helper function to sanitize text for PDF
      const sanitizeForPDF = (text: string): string => {
        if (!text) return ""
        // Replace common problematic characters and ensure proper encoding
        return text
          .replace(/&/g, 'and')
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/"/g, '"')
          .replace(/'/g, "'")
      }

      // 3. Line Items Table
      autoTable(doc, {
        startY: 95,
        head: [['ITEM', 'PAYMENT METHOD', 'TOTAL']],
        body: [[
          `${sanitizeForPDF(transaction.product)} - ${sanitizeForPDF(transaction.amount)}`,
          sanitizeForPDF(transaction.paymentMethod),
          `Rs. ${transaction.price}`
        ]],
        headStyles: {
          fillColor: [126, 58, 242],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [31, 41, 55]
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        margin: { left: 20, right: 20 }
      });

      // 4. Gift Card Section (Conditional)
      // Use lastAutoTable.finalY to position content after the table
      const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : 100;

      if (transaction.status === "Completed" && transaction.giftcard_code) {
        doc.setFillColor(254, 252, 232); // bg-yellow-50
        doc.setDrawColor(254, 240, 138); // border-yellow-200
        doc.roundedRect(20, finalY, pageWidth - 40, 25, 3, 3, 'FD');

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(146, 64, 14); // text-yellow-800
        doc.text("YOUR GIFTCARD CODE:", 30, finalY + 10);

        doc.setFontSize(14);
        doc.setFont("courier", "bold");
        doc.setTextColor(180, 83, 9); // text-yellow-700
        doc.text(transaction.giftcard_code, 30, finalY + 18);
      }

      // Footer
      const footerY = doc.internal.pageSize.height - 15;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(156, 163, 175);
      doc.text("Thank you for shopping with Byiora!", pageWidth / 2, footerY - 5, { align: "center" });
      doc.text("support@byiora.com.np", pageWidth / 2, footerY, { align: "center" });

      doc.save(`Byiora_Receipt_${transaction.transactionId}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate receipt. There was an error processing the document.");
    }
  };

  if (isLoading) {
    return <TransactionsLoading />;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-brand-purple">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Lock className="h-16 w-16 text-white/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Sign In Required</h3>
            <p className="text-white/70 mb-6">
              Please sign in to view your transaction history.
            </p>
            <Button
              onClick={() => router.push("/en-np/sign-up?redirect=/transactions")}
              className="bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white rounded-full px-8"
            >
              Sign In
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold text-white">Transaction History</h1>
          </div>

          <div className="flex items-center gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-brand-white border-gray-200 text-brand-charcoal">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-brand-white border-gray-200">
                <SelectItem value="all" className="text-brand-charcoal">All Transactions</SelectItem>
                <SelectItem value="pending" className="text-brand-charcoal">Pending</SelectItem>
                <SelectItem value="completed" className="text-brand-charcoal">Completed</SelectItem>
                <SelectItem value="failed" className="text-brand-charcoal">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6">
          {filteredTransactions.map((transaction) => {
            const isKhalti = transaction.paymentMethod?.toLowerCase().includes("khalti");
            const secondsElapsed = (new Date().getTime() - new Date(transaction.date).getTime()) / 1000;
            const isKhaltiExpired = isKhalti && (transaction.status === "Payment Pending" || transaction.status === "Processing") && secondsElapsed > 7200;
            const displayStatus = isKhaltiExpired ? "Payment Failed" : transaction.status;

            return (
            <Card key={transaction.id} className="bg-brand-white border-gray-200 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-brand-charcoal text-lg">{transaction.product}</CardTitle>
                  {getStatusBadge(displayStatus)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-brand-light-gray">Order date</p>
                    <p className="text-brand-charcoal font-medium">
                      {new Date(transaction.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-brand-light-gray">Payment status</p>
                    <p className="text-brand-charcoal font-medium">{getNormalizedStatusText(transaction.status)}</p>
                  </div>
                  <div>
                    <p className="text-brand-light-gray">Order ID</p>
                    <p className="text-brand-charcoal font-medium font-mono text-xs">{transaction.transactionId}</p>
                  </div>
                </div>

                {transaction.giftcard_code && transaction.status.toLowerCase() === "completed" && (
                  <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-lg px-4 py-3 w-fit">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
                      <span className="text-sm font-semibold text-[#92400E] whitespace-nowrap">Giftcode:</span>
                      <div className="flex items-center gap-1 bg-white border border-[#FEF3C7] rounded px-2 py-1">
                        <code className="text-[#D97706] font-mono font-bold tracking-wider text-sm">
                          {revealedCodes[transaction.id] ? transaction.giftcard_code : "••••  ••••  ••••"}
                        </code>
                        <button
                          className="ml-1.5 text-[#D97706] hover:text-[#92400E] transition-colors flex-shrink-0"
                          onClick={() => setRevealedCodes(prev => ({ ...prev, [transaction.id]: !prev[transaction.id] }))}
                        >
                          {revealedCodes[transaction.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-brand-light-gray">Item purchased</p>
                    <p className="text-brand-charcoal font-medium">{transaction.amount}</p>
                  </div>
                  <div>
                    <p className="text-brand-light-gray">Payment method</p>
                    <p className="text-brand-charcoal font-medium">{transaction.paymentMethod}</p>
                  </div>
                  <div>
                    <p className="text-brand-light-gray">Total payment</p>
                    <p className="text-brand-sky-blue font-bold text-lg">Rs. {transaction.price}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <p className="text-sm text-brand-light-gray flex-1">
                    {transaction.status === "Completed" ? "✅ Completed" :
                      transaction.status === "Paid" ? "✅ Payment Verified (Pending Fulfillment)" :
                      transaction.status === "Processing" ? "⏳ Awaiting Confirmation" :
                      transaction.status === "Payment Pending" ? "⏳ Awaiting Payment" :
                      transaction.status === "Payment Failed" ? "❌ Payment Not Received" :
                      transaction.status === "Cancelled" ? "❌ Cancelled" :
                      transaction.status === "Refunded" ? "🟣 Refunded" :
                      transaction.failure_remarks ? `❌ ${transaction.failure_remarks}` : "❌ Transaction failed"}
                  </p>

                  <div className="flex gap-2">
                    {(() => {
                      const isKhalti = transaction.paymentMethod?.toLowerCase().includes("khalti");
                      const secondsElapsed = (new Date().getTime() - new Date(transaction.date).getTime()) / 1000;
                      const isWithin7200s = secondsElapsed <= 7200; // 2 hours (7200s)
                      const isUnpaidState = ["Payment Failed", "Payment Pending", "Processing", "Cancelled", "Failed"].includes(transaction.status);

                      if (isKhalti) {
                        return (
                          <>
                            {isUnpaidState && isWithin7200s && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetryKhalti(transaction.transactionId)}
                                disabled={retryingKhaltiId === transaction.transactionId}
                                className="border-[#5E2E87] text-[#5E2E87] hover:bg-[#5E2E87]/10 font-semibold"
                              >
                                {retryingKhaltiId === transaction.transactionId ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                )}
                                Pay with Khalti
                              </Button>
                            )}

                            {isUnpaidState && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorder(transaction.transactionId)}
                                disabled={reorderingId === transaction.transactionId}
                                className="border-[#7E3AF2] text-[#7E3AF2] hover:bg-[#7E3AF2]/10 font-semibold"
                              >
                                {reorderingId === transaction.transactionId ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-4 w-4 mr-2" />
                                )}
                                Buy Again
                              </Button>
                            )}

                            {transaction.status === "Completed" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReceipt(transaction.transactionId)}
                                className="border-brand-sky-blue text-brand-sky-blue hover:bg-brand-sky-blue/10"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download Receipt
                              </Button>
                            )}
                          </>
                        )
                      }

                      // Non-Khalti payment methods (NepalPay, Fonepay, Static QR)
                      return (
                        <>
                          {transaction.status === "Payment Failed" && transaction.failure_remarks !== "Cancelled by user" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setVerifyingPhoneId(transaction.transactionId);
                                  setPhoneNumber("");
                                }}
                                className="border-[#0ea5e9] text-[#0ea5e9] hover:bg-[#0ea5e9]/10 font-semibold"
                              >
                                <Phone className="h-4 w-4 mr-2" />
                                Verify Payment
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorder(transaction.transactionId)}
                                disabled={reorderingId === transaction.transactionId}
                                className="border-[#7E3AF2] text-[#7E3AF2] hover:bg-[#7E3AF2]/10 font-semibold"
                              >
                                {reorderingId === transaction.transactionId ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-4 w-4 mr-2" />
                                )}
                                Buy Again
                              </Button>
                            </>
                          )}

                          {transaction.status === "Payment Pending" && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setVerifyingPhoneId(transaction.transactionId);
                                  setPhoneNumber("");
                                }}
                                className="border-[#0ea5e9] text-[#0ea5e9] hover:bg-[#0ea5e9]/10 font-semibold"
                              >
                                Verify Payment
                              </Button>
                              {secondsElapsed < 300 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/checkout/${transaction.transactionId}`)}
                                  className="border-[#7E3AF2] text-[#7E3AF2] hover:bg-[#7E3AF2]/10 font-semibold"
                                >
                                  Return to Payment
                                </Button>
                              )}
                            </>
                          )}

                          {transaction.status === "Completed" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadReceipt(transaction.transactionId)}
                              className="border-brand-sky-blue text-brand-sky-blue hover:bg-brand-sky-blue/10"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Receipt
                            </Button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Phone Verification Dialog */}
                <Dialog open={verifyingPhoneId === transaction.transactionId} onOpenChange={(open) => !open && setVerifyingPhoneId(null)}>
                  <DialogContent className="sm:max-w-md bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-gray-800">
                        <Phone className="h-5 w-5 text-[#0ea5e9]" />
                        Verify Mobile Payment
                      </DialogTitle>
                      <DialogDescription className="text-gray-500">
                        If you already paid but the session expired, enter the phone number you used to pay. We will verify it with the bank.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 mt-4">
                      <div className="flex gap-3">
                        <Input
                          type="tel"
                          placeholder="e.g. 98XXXXXXXX"
                          value={phoneNumber}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, "");
                            if (val.length > 0 && val[0] !== "9") {
                              val = ""; // Force starting with 9
                            }
                            if (val.length <= 10) {
                              setPhoneNumber(val);
                            }
                          }}
                          className="flex-1 border-gray-300 focus:border-[#0ea5e9] bg-white/70 placeholder:text-gray-400"
                        />
                        <Button
                          type="button"
                          onClick={() => handleVerifyPhone(transaction.transactionId)}
                          disabled={isPhoneVerifying || !phoneNumber || !captchaToken}
                          className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white shadow-md"
                        >
                          {isPhoneVerifying ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Verify
                        </Button>
                      </div>
                      <div className="flex justify-center">
                        <TurnstileWidget onToken={setCaptchaToken} />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          );
        })}
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-white mb-2">No transactions found</h3>
            <p className="text-white/70 mb-6">
              {filterStatus === "all"
                ? "You haven't made any purchases yet."
                : `No ${filterStatus} transactions found.`}
            </p>
            <Button
              type="button"
              onClick={() => router.push("/")}
              className="bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white rounded-full px-8"
            >
              Start Shopping
            </Button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
