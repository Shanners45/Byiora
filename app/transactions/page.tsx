"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Filter, Download, Lock, Eye, EyeOff, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { useAuth } from "@/lib/auth-context";

export default function TransactionsPage() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const { isLoggedIn, transactions, user, isLoading } = useAuth();

  console.log("Transactions page rendered, isLoggedIn:", isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn && !isLoading) {
      console.log("User not logged in, redirecting to home");
      router.push("/");
    }
  }, [isLoggedIn, isLoading, router]);

  const filteredTransactions = transactions.filter(transaction =>
    filterStatus === "all" || transaction.status.toLowerCase() === filterStatus.toLowerCase()
  );

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "processing":
        return <Badge className="bg-brand-soft-yellow text-brand-charcoal">Processing</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

      doc.text("Transaction ID:", col1, gridY);
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
      doc.text("support@byiora.store", pageWidth / 2, footerY, { align: "center" });

      doc.save(`Byiora_Receipt_${transaction.transactionId}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate receipt. There was an error processing the document.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-charcoal border-t-transparent mx-auto"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Lock className="h-16 w-16 text-brand-light-gray mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-brand-charcoal mb-2">Sign In Required</h3>
            <p className="text-brand-light-gray mb-6">
              Please sign in to view your transaction history.
            </p>
            <Button
              onClick={() => router.push("/")}
              className="bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white"
            >
              Go to Home
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-brand-charcoal hover:bg-brand-sky-blue/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold text-brand-charcoal">Transaction History</h1>
          </div>

          <div className="flex items-center gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-brand-white border-gray-200 text-brand-charcoal">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-brand-white border-gray-200">
                <SelectItem value="all" className="text-brand-charcoal">All Transactions</SelectItem>
                <SelectItem value="completed" className="text-brand-charcoal">Completed</SelectItem>
                <SelectItem value="processing" className="text-brand-charcoal">Processing</SelectItem>
                <SelectItem value="failed" className="text-brand-charcoal">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6">
          {filteredTransactions.map((transaction) => (
            <Card key={transaction.id} className="bg-brand-white border-gray-200 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-brand-charcoal text-lg">{transaction.product}</CardTitle>
                  {getStatusBadge(transaction.status)}
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
                    <p className="text-brand-charcoal font-medium">{transaction.status}</p>
                  </div>
                  <div>
                    <p className="text-brand-light-gray">Transaction ID</p>
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
                  <p className="text-sm text-brand-light-gray">
                    {transaction.status === "Completed" ? "✅ Completed" :
                      transaction.status === "Processing" ? "⏳ Payment processing" :
                        transaction.failure_remarks ? `❌ ${transaction.failure_remarks}` : "❌ Transaction failed"}
                  </p>

                  {transaction.status === "Completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadReceipt(transaction.transactionId)}
                      className="border-brand-sky-blue text-brand-sky-blue hover:bg-brand-sky-blue/10"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Receipt
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-brand-charcoal mb-2">No transactions found</h3>
            <p className="text-brand-light-gray mb-6">
              {filterStatus === "all"
                ? "You haven't made any purchases yet."
                : `No ${filterStatus} transactions found.`}
            </p>
            <Button
              onClick={() => router.push("/")}
              className="bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white"
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
