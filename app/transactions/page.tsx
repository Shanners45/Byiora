"use client";

import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, Filter, Download, Lock, Eye, EyeOff, Gift, RefreshCw, Phone, CheckCircle2, ExternalLink } from "lucide-react";
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
import { retryKhaltiPaymentAction } from "@/app/actions/transactions";
import { verifyPaymentByPhoneAction } from "@/app/actions/checkout";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { SELLER } from "@/lib/seller";
import { packTitle } from "@/lib/denominations";

export default function TransactionsPage() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  
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
    const trimmed = phoneNumber.trim();
    if (!trimmed || trimmed.length < 6) {
      toast.error("Please enter a valid 10-digit phone number or bank Transaction ID");
      return;
    }
    if (!captchaToken) {
      toast.error("Please complete the security check");
      return;
    }

    setIsPhoneVerifying(true);
    try {
      const res = await verifyPaymentByPhoneAction(transactionId, trimmed, captchaToken);
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
      const left = 15;
      const right = pageWidth - 15;
      // jsPDF's built-in fonts only cover Latin-1: drop emoji and other scripts instead of printing junk.
      const pdfText = (text: unknown) => String(text ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "").replace(/\s+/g, " ").trim();
      const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
      const paid = Number(String(transaction.price ?? "").replace(/,/g, "")) || 0;
      // Promo orders store the pre-discount price; price is what the customer paid.
      const discount = Number(transaction.discount_amount) || 0;
      const listPrice = discount > 0 ? Number(transaction.original_price) || paid + discount : paid;
      const invoiceDate = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kathmandu", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(new Date(transaction.date || Date.now())) + " NPT";

      // 1. Header band: logo, title, invoice number
      doc.setFillColor(90, 53, 136);
      doc.rect(0, 0, pageWidth, 36, "F");
      let logo: string | null = null;
      try {
        const response = await fetch("/logo-final.png");
        if (response.ok) {
          const blob = await response.blob();
          logo = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("Logo fetch failed, using text fallback:", e);
      }
      doc.setTextColor(255, 255, 255);
      if (logo?.startsWith("data:image")) {
        doc.addImage(logo, "PNG", left, 9, 46, 15); // logo-final.png is ~3.07:1
      } else {
        doc.setFont("helvetica", "bold").setFontSize(22).text("BYIORA", left, 22);
      }
      doc.setFont("helvetica", "bold").setFontSize(20).text("INVOICE", right, 17, { align: "right" });
      doc.setFont("helvetica", "normal").setFontSize(9).text(`Invoice No. ${pdfText(transaction.transactionId)}`, right, 25, { align: "right" });
      doc.text(`Invoice Date: ${invoiceDate}`, right, 30, { align: "right" });

      // 2. Seller and buyer
      const colB = pageWidth / 2 + 5;
      doc.setTextColor(107, 114, 128).setFont("helvetica", "bold").setFontSize(8);
      doc.text("SOLD BY", left, 48);
      doc.text("BILLED TO", colB, 48);
      const sellerLines = [
        `PAN No.: ${SELLER.pan}`,
        `Address: ${SELLER.address}`,
        `Phone: ${SELLER.phone}`,
        `Email: ${SELLER.email}`,
        `Web: ${SELLER.website}`,
      ];
      const buyerName = pdfText(user?.name);
      const buyerLines = [`Email: ${pdfText(transaction.email) || "N/A"}`];
      doc.setTextColor(31, 41, 55).setFont("helvetica", "bold").setFontSize(11);
      doc.text(SELLER.name, left, 55);
      doc.text(buyerName || "Customer", colB, 55);
      doc.setFont("helvetica", "normal").setFontSize(9);
      sellerLines.forEach((l, i) => doc.text(l, left, 61 + i * 5));
      buyerLines.forEach((l, i) => doc.text(l, colB, 61 + i * 5));

      // 3. Line items and total
      const pack = pdfText(packTitle({ amount: transaction.amount, denomination_category: transaction.denomination_category }));
      autoTable(doc, {
        startY: 61 + sellerLines.length * 5 + 6,
        theme: "striped",
        head: [["#", "Description", "Qty", "Unit price", "Amount"]],
        body: [["1", [pdfText(transaction.product), pack].filter(Boolean).join(" - "), "1", rs(listPrice), rs(listPrice)]],
        foot: [
          [{ content: "Subtotal", colSpan: 4, styles: { halign: "right" } }, { content: rs(listPrice), styles: { halign: "right" } }],
          ...(discount > 0
            ? [[
                { content: `Discount${transaction.promo_code ? ` (Promo: ${pdfText(transaction.promo_code)})` : ""}`, colSpan: 4, styles: { halign: "right" as const, textColor: [22, 163, 74] as [number, number, number] } },
                { content: `- ${rs(discount)}`, styles: { halign: "right" as const, textColor: [22, 163, 74] as [number, number, number] } },
              ]]
            : []),
          [{ content: "Total", colSpan: 4, styles: { halign: "right" } }, { content: rs(paid), styles: { halign: "right" } }],
        ],
        headStyles: { fillColor: [90, 53, 136], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
        footStyles: { fillColor: [255, 255, 255], textColor: [31, 41, 55], fontStyle: "bold", fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 10 },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 30, halign: "right" },
        },
        margin: { left, right: 15 },
      });

      // Footer
      const footerY = doc.internal.pageSize.height - 18;
      doc.setDrawColor(229, 231, 235).setLineWidth(0.3).line(left, footerY - 6, right, footerY - 6);
      doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(156, 163, 175);
      doc.text("This is a computer-generated invoice and does not need a signature.", pageWidth / 2, footerY, { align: "center" });
      doc.text(`Thank you for shopping with ${SELLER.name}  |  ${SELLER.email}  |  ${SELLER.phone}  |  ${SELLER.website}`, pageWidth / 2, footerY + 5, { align: "center" });

      doc.save(`Byiora_Invoice_${transaction.transactionId}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate invoice. There was an error processing the document.");
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
              onClick={() => router.push("/en-np/sign-in?redirect=/transactions")}
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
            const isKhalti = transaction.paymentMethod?.toLowerCase().includes("khalti") || transaction.payment_category === "khalti";
            const isDynamic = transaction.payment_category === "fonepay" || transaction.payment_category === "nepalpay" || transaction.paymentMethod?.toLowerCase().includes("fonepay") || transaction.paymentMethod?.toLowerCase().includes("nepalpay");
            const secondsElapsed = (new Date().getTime() - new Date(transaction.date).getTime()) / 1000;
            const isKhaltiExpired = isKhalti && (transaction.status === "Payment Pending" || transaction.status === "Processing") && secondsElapsed > 7200;
            const isDynamicExpired = isDynamic && (transaction.status === "Payment Pending" || transaction.status === "Processing") && secondsElapsed >= 300;
            const displayStatus = isKhaltiExpired || isDynamicExpired ? "Payment Failed" : transaction.status;

            const isDigitalGoods = transaction.product_category === "digital-goods" || (!transaction.product_category && !transaction.product.toLowerCase().includes("topup") && !transaction.product.toLowerCase().includes("recharge") && !transaction.product.toLowerCase().includes("direct login"));

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
                    <p className="text-brand-charcoal font-medium">{getNormalizedStatusText(displayStatus)}</p>
                  </div>
                  <div>
                    <p className="text-brand-light-gray">Order ID</p>
                    <p className="text-brand-charcoal font-medium font-mono text-xs">{transaction.transactionId}</p>
                  </div>
                </div>

                {transaction.giftcard_code && transaction.status.toLowerCase() === "completed" && (
                  <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-lg px-4 py-3 w-fit max-w-full">
                    <div className="flex items-start gap-2">
                      <Gift className="h-4 w-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-semibold text-[#92400E] whitespace-nowrap mt-0.5">Giftcode:</span>
                      <div className="flex items-center gap-1 bg-white border border-[#FEF3C7] rounded px-2 py-1 min-w-0">
                        <code className="text-[#D97706] font-mono font-bold tracking-wider text-xs sm:text-sm break-all min-w-0">
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
                    {displayStatus === "Completed" ? "✅ Completed" :
                      displayStatus === "Paid" ? "✅ Payment Verified (Pending Fulfillment)" :
                      displayStatus === "Processing" ? (transaction.payment_category === "static" ? "⏳ Awaiting Confirmation" : "⏳ Processing Payment") :
                      displayStatus === "Payment Pending" ? "⏳ Awaiting Payment" :
                      displayStatus === "Payment Failed" ? "❌ Payment Not Received" :
                      displayStatus === "Cancelled" ? "❌ Cancelled" :
                      displayStatus === "Refunded" ? "🟣 Refunded" :
                      transaction.failure_remarks ? `❌ ${transaction.failure_remarks}` : "❌ Transaction failed"}
                  </p>

                  <div className="flex gap-2">
                    {(() => {
                      const isUnpaidState = ["Payment Failed", "Payment Pending", "Processing", "Cancelled", "Failed"].includes(displayStatus);

                      if (isKhalti) {
                        const isWithin7200s = secondsElapsed <= 7200;
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



                            {displayStatus === "Completed" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReceipt(transaction.transactionId)}
                                className="border-brand-sky-blue text-brand-sky-blue hover:bg-brand-sky-blue/10"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download Invoice
                              </Button>
                            )}
                          </>
                        )
                      }

                      const isWithin24Hours = secondsElapsed <= 86400; // 24 hours window for payment verification
                      const isUnpaidOrFailed = displayStatus === "Payment Failed" || displayStatus === "Failed" || isDynamicExpired;

                      return (
                        <>
                          {isUnpaidOrFailed && transaction.failure_remarks !== "Cancelled by user" && (
                            <>
                              {isWithin24Hours && (
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
                              )}

                            </>
                          )}



                          {(displayStatus === "Payment Pending" || displayStatus === "Processing") && !isDynamicExpired && (
                            <>
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

                          {displayStatus === "Completed" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadReceipt(transaction.transactionId)}
                              className="border-brand-sky-blue text-brand-sky-blue hover:bg-brand-sky-blue/10"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Invoice
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
                        Verify Payment
                      </DialogTitle>
                      <DialogDescription className="text-gray-500 text-xs">
                        Enter your mobile banking phone number or the 10-digit Transaction ID from your payment receipt (e.g. YONO SBI, eSewa, etc).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 mt-4">
                      <div className="flex gap-3">
                        <Input
                          type="text"
                          placeholder="e.g. 98XXXXXXXX or 1236059374"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          maxLength={30}
                          className="flex-1 border-gray-300 focus:border-[#0ea5e9] bg-white/70 placeholder:text-gray-400 text-sm"
                        />
                        <Button
                          type="button"
                          onClick={() => handleVerifyPhone(transaction.transactionId)}
                          disabled={isPhoneVerifying || !phoneNumber.trim() || !captchaToken}
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
