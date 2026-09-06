"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, RefreshCw, KeyRound, AlertCircle, ChevronDown, ChevronRight, CheckCircle2, Eye, EyeOff, Trash2, Flame, Copy, Check } from "lucide-react"
import { getInventoryProductsAction, getProductStockAction, addInventoryCodesAction, getDenominationCodesAction, deleteInventoryCodeAction, deleteInventoryCodeByValueAction, revealAdminCodeAction } from "@/app/actions/inventory"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [products, setProducts] = useState<any[]>([])
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})
  const [productStocks, setProductStocks] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  // Add Codes Dialog State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedDenom, setSelectedDenom] = useState("")
  const [codesInput, setCodesInput] = useState("")
  const [addingCodes, setAddingCodes] = useState(false)

  // Manage Codes Dialog State
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [manageProductId, setManageProductId] = useState("")
  const [manageProductName, setManageProductName] = useState("")
  const [manageDenom, setManageDenom] = useState("")
  const [manageCodes, setManageCodes] = useState<any[]>([])
  const [loadingManageCodes, setLoadingManageCodes] = useState(false)
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({})
  const [revealingCodeId, setRevealingCodeId] = useState<string | null>(null)
  const [deletingCodeId, setDeletingCodeId] = useState<string | null>(null)
  const [burnInput, setBurnInput] = useState("")
  const [isBurning, setIsBurning] = useState(false)
  const [codeToDelete, setCodeToDelete] = useState<any | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const result = await getInventoryProductsAction()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setProducts(result.products || [])
    } catch (error) {
      toast.error("Failed to load inventory products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadStockForProduct = async (productId: string) => {
    try {
      const result = await getProductStockAction(productId)
      if (result.success) {
        setProductStocks(prev => ({ ...prev, [productId]: result.stats }))
      }
    } catch (error) {
      console.error("Error loading stock", error)
    }
  }

  const toggleExpand = (productId: string) => {
    let shouldLoad = false
    setExpandedProducts(prev => {
      const newState = !prev[productId]
      if (newState && !productStocks[productId]) {
        shouldLoad = true
      }
      return { ...prev, [productId]: newState }
    })
    
    if (shouldLoad) {
      loadStockForProduct(productId)
    }
  }

  const openAddDialog = (productId: string, denomLabel: string) => {
    setSelectedProductId(productId)
    setSelectedDenom(denomLabel)
    setCodesInput("")
    setIsAddOpen(true)
  }

  const handleAddCodes = async () => {
    if (!codesInput.trim()) {
      toast.error("Please enter at least one code")
      return
    }

    setAddingCodes(true)
    try {
      const result = await addInventoryCodesAction(selectedProductId, selectedDenom, codesInput)
      if (result.success) {
        toast.success(`Successfully added ${result.added} codes`)
        if (result.failed > 0) {
          toast.warning(`Failed to add ${result.failed} codes (Duplicates/Errors)`)
          console.warn("Failed codes details:", result.failedDetails)
        }
        setIsAddOpen(false)
        loadStockForProduct(selectedProductId)
      } else {
        toast.error(result.error || "Failed to add codes")
      }
    } catch (err: any) {
      toast.error("An error occurred while adding codes")
    } finally {
      setAddingCodes(false)
    }
  }

  const openManageDialog = async (productId: string, productName: string, denomLabel: string) => {
    setManageProductId(productId)
    setManageProductName(productName)
    setManageDenom(denomLabel)
    setBurnInput("")
    setRevealedCodes({})
    setCodeToDelete(null)
    setIsManageOpen(true)
    await loadCodesForDenom(productId, denomLabel)
  }

  const loadCodesForDenom = async (productId: string, denomLabel: string) => {
    setLoadingManageCodes(true)
    try {
      const res = await getDenominationCodesAction(productId, denomLabel)
      if (res.success) {
        setManageCodes(res.codes || [])
      } else {
        toast.error(res.error || "Failed to load codes")
      }
    } catch (e) {
      toast.error("Error loading denomination codes")
    } finally {
      setLoadingManageCodes(false)
    }
  }

  const handleRevealCode = async (inventoryId: string) => {
    if (revealedCodes[inventoryId]) {
      setRevealedCodes(prev => {
        const next = { ...prev }
        delete next[inventoryId]
        return next
      })
      return
    }

    setRevealingCodeId(inventoryId)
    try {
      const res = await revealAdminCodeAction(inventoryId)
      if (res.success && res.code) {
        setRevealedCodes(prev => ({ ...prev, [inventoryId]: res.code }))
      } else {
        toast.error(res.error || "Failed to reveal code")
      }
    } catch (e) {
      toast.error("Error revealing code")
    } finally {
      setRevealingCodeId(null)
    }
  }

  const handleDeleteCode = async (inventoryId: string) => {
    setDeletingCodeId(inventoryId)
    try {
      const res = await deleteInventoryCodeAction(inventoryId)
      if (res.success) {
        toast.success("Code deleted from inventory")
        setManageCodes(prev => prev.filter(c => c.id !== inventoryId))
        loadStockForProduct(manageProductId)
        setCodeToDelete(null)
      } else {
        toast.error(res.error || "Failed to delete code")
      }
    } catch (e) {
      toast.error("An error occurred while deleting code")
    } finally {
      setDeletingCodeId(null)
    }
  }

  const handleBurnByValue = async () => {
    if (!burnInput.trim()) {
      toast.error("Please paste a code to delete")
      return
    }

    setIsBurning(true)
    try {
      const res = await deleteInventoryCodeByValueAction(manageProductId, manageDenom, burnInput)
      if (res.success) {
        toast.success("Misentered code found and deleted successfully")
        setBurnInput("")
        await loadCodesForDenom(manageProductId, manageDenom)
        loadStockForProduct(manageProductId)
      } else {
        toast.error(res.error || "Could not find matching available code")
      }
    } catch (e) {
      toast.error("Failed to delete code by value")
    } finally {
      setIsBurning(false)
    }
  }

  const handleCopyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Gift Card Inventory</h1>
          <p className="text-[#4B5563]">Manage encrypted gift card codes for automated delivery</p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          className="border-[#F59E0B] text-[#92400E] hover:bg-[#FEF7E0] self-start sm:self-auto"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
        <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937]">Digital Goods & Games</CardTitle>
          <CardDescription className="text-[#92400E] font-medium">Click on a product to view denominations and add stock.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search products..."
              className="pl-10 bg-white text-[#1F2937] border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-x-auto bg-white">
            <Table>
              <TableHeader className="bg-white border-b border-[#F59E0B]/20">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-[#1F2937] font-semibold">Product</TableHead>
                  <TableHead className="text-[#1F2937] font-semibold">Category</TableHead>
                  <TableHead className="text-[#1F2937] font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((product) => (
                  <React.Fragment key={product.id}>
                    <TableRow 
                      className="cursor-pointer hover:bg-[#FEF7E0]/50 transition-colors border-b border-[#F59E0B]/10"
                      onClick={() => toggleExpand(product.id)}
                    >
                      <TableCell>
                        {expandedProducts[product.id] ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium flex items-center gap-3">
                        <div className="h-10 w-10 relative rounded overflow-hidden bg-gray-100 shrink-0">
                          {product.logo ? (
                            <Image src={product.logo} alt={product.name} fill className="object-cover" />
                          ) : (
                            <KeyRound className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400" />
                          )}
                        </div>
                        <span className="text-[#1F2937]">{product.name}</span>
                      </TableCell>
                      <TableCell className="capitalize text-[#4B5563]">{product.category}</TableCell>
                      <TableCell>
                        {product.denominations?.length ? (
                          <Badge variant="outline" className="text-[#4B5563] border-gray-300">
                            {product.denominations.length} Denominations
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">No Denominations</Badge>
                        )}
                      </TableCell>
                    </TableRow>

                    {expandedProducts[product.id] && (
                      <TableRow className="bg-[#FEF7E0]/20">
                        <TableCell colSpan={4} className="p-0">
                          <div className="p-4 pl-4 sm:pl-14 border-t border-[#F59E0B]/20 shadow-inner bg-[#FEF7E0]/40">
                            <h4 className="text-sm font-semibold mb-3 text-[#1F2937]">Denomination Inventory</h4>
                            {product.denominations?.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {product.denominations.map((denom: any) => {
                                  const stats = productStocks[product.id]?.[denom.label] || { available: 0, delivered: 0 }
                                  return (
                                    <div key={denom.label} className="bg-white p-3 rounded-lg shadow-sm border border-[#F59E0B]/20 flex flex-col justify-between">
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="font-semibold text-[#1F2937]">{denom.label}</div>
                                        <Badge variant="outline" className={stats.available > 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>
                                          {stats.available} Available
                                        </Badge>
                                      </div>
                                      <div className="flex justify-between items-center text-xs text-[#4B5563] mt-2">
                                        <span>Delivered: {stats.delivered}</span>
                                        <div className="flex items-center gap-1.5">
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 px-2 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#FEF7E0]/80 font-medium"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              openManageDialog(product.id, product.name, denom.label)
                                            }}
                                            title="View, reveal, or delete codes"
                                          >
                                            <Eye className="h-3 w-3 mr-1 text-gray-500" /> Manage
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 px-2 text-[#92400E] hover:text-[#92400E] hover:bg-[#FEF7E0] font-medium"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              openAddDialog(product.id, denom.label)
                                            }}
                                          >
                                            <Plus className="h-3 w-3 mr-1" /> Add Codes
                                          </Button>
                                        </div>
                                      </div>

                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-[#4B5563]">Add denominations to this product first.</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProducts.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
              <p className="text-sm text-[#92400E] font-medium">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} entries
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-[#F59E0B]/30 text-[#92400E] hover:bg-[#FEF7E0] disabled:opacity-40"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="border-[#F59E0B]/30 text-[#92400E] hover:bg-[#FEF7E0] disabled:opacity-40"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-[#F59E0B]/30">
          <DialogHeader>
            <DialogTitle className="text-[#1F2937]">Add Gift Card Codes</DialogTitle>
            <DialogDescription className="text-[#4B5563] font-medium">
              Adding codes for <span className="font-bold text-[#1F2937]">{selectedDenom}</span>. 
              Paste multiple codes separated by new lines. These will be encrypted instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder={`XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY`}
              className="min-h-[150px] font-mono text-sm bg-white text-[#1F2937] border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
              value={codesInput}
              onChange={(e) => setCodesInput(e.target.value)}
            />
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#92400E] bg-[#FEF7E0] border border-[#F59E0B]/30 p-2.5 rounded-md">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Duplicate codes will be automatically ignored using blind hashing.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={addingCodes} className="border-gray-200 hover:bg-gray-50">
              Cancel
            </Button>
            <Button onClick={handleAddCodes} disabled={addingCodes} className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white">
              {addingCodes ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Encrypting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Add Securely
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Codes Dialog */}
      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-2xl bg-white border border-[#F59E0B]/30 max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-[#F59E0B]/20">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-[#1F2937] flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-[#92400E]" />
                  Manage Codes: {manageDenom}
                </DialogTitle>
                <DialogDescription className="text-[#4B5563] mt-1">
                  {manageProductName} &bull; Manage stored gift card codes, reveal for audit, or remove mistyped codes.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Burn / Delete Typo Input */}
            <div className="mt-3 p-3 bg-[#FEF7E0] border border-[#F59E0B]/40 rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#92400E]">
                <Flame className="h-4 w-4 text-red-500" />
                <span>Quick Delete by Exact Code (Instant Typo Correction)</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste the exact wrong code you entered (e.g. XXXX-XXXX)..."
                  className="h-8 text-xs bg-white text-[#1F2937] border border-[#F59E0B]/30 placeholder:text-gray-400 font-mono"
                  value={burnInput}
                  onChange={(e) => setBurnInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBurnByValue()}
                />
                <Button
                  size="sm"
                  onClick={handleBurnByValue}
                  disabled={isBurning || !burnInput.trim()}
                  className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white text-xs shrink-0 font-medium"
                >
                  {isBurning ? (
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Codes List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingManageCodes ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-[#7E3AF2] border-gray-200" />
              </div>
            ) : manageCodes.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                <KeyRound className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                No codes in stock for this denomination yet.
              </div>
            ) : (
              <div className="rounded-md border border-[#F59E0B]/20 overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#FEF7E0]/40">
                    <TableRow className="border-b border-[#F59E0B]/20">
                      <TableHead className="text-xs font-semibold text-[#1F2937]">Code Preview</TableHead>
                      <TableHead className="text-xs font-semibold text-[#1F2937]">Added</TableHead>
                      <TableHead className="text-xs font-semibold text-[#1F2937]">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-[#1F2937] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manageCodes.map((code) => {
                      const isRevealed = !!revealedCodes[code.id]
                      const displayText = isRevealed ? revealedCodes[code.id] : code.maskedCode
                      const isAvailable = code.status === "AVAILABLE"

                      return (
                        <TableRow key={code.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className={isRevealed ? "text-green-700 font-bold tracking-wider" : "text-gray-700 font-medium"}>
                                {displayText}
                              </span>
                              {isRevealed && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(code.id, displayText)}
                                  className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 transition"
                                  title="Copy code"
                                >
                                  {copiedId === code.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {code.createdAt ? (
                              new Date(code.createdAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                isAvailable
                                  ? "bg-green-50 text-green-700 border-green-200 text-[11px]"
                                  : "bg-gray-100 text-gray-600 border-gray-200 text-[11px]"
                              }
                            >
                              {code.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Reveal / Hide button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-[#1F2937]"
                                onClick={() => handleRevealCode(code.id)}
                                disabled={revealingCodeId === code.id}
                                title={isRevealed ? "Hide code" : "Reveal full code (Admin audit)"}
                              >
                                {revealingCodeId === code.id ? (
                                  <div className="h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                                ) : isRevealed ? (
                                  <EyeOff className="h-3.5 w-3.5 text-gray-600" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                                )}
                              </Button>

                              {/* Delete button */}
                              {isAvailable ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setCodeToDelete(code)}
                                  title="Delete code from inventory"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <span className="text-[11px] text-gray-400 italic px-1" title="Delivered to customer — cannot be deleted">
                                  Delivered
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-3 border-t border-gray-100 bg-gray-50">
            <Button variant="outline" size="sm" onClick={() => setIsManageOpen(false)} className="border-gray-300">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog for Delete */}
      <AlertDialog open={!!codeToDelete} onOpenChange={(open) => !open && setCodeToDelete(null)}>
        <AlertDialogContent className="bg-white border border-[#F59E0B]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1F2937] flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Gift Card Code?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#4B5563]">
              Are you sure you want to delete this code (
              <span className="font-mono font-bold text-[#1F2937]">{codeToDelete?.maskedCode}</span>
              ) from <span className="font-bold text-[#1F2937]">{manageDenom}</span>?
              <br /><br />
              This will permanently remove it from available stock so it will never be sent to any customer. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingCodeId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => codeToDelete && handleDeleteCode(codeToDelete.id)}
              disabled={!!deletingCodeId}
            >
              {deletingCodeId ? "Deleting..." : "Yes, Delete Code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

