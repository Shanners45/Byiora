"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, RefreshCw, KeyRound, AlertCircle, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react"
import { getInventoryProductsAction, getProductStockAction, addInventoryCodesAction } from "@/app/actions/inventory"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
    </div>
  )
}
