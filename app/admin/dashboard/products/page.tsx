"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Edit, Trash2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { type Product } from "@/lib/product-categories"
import { getAllProductsAdminAction } from "@/app/actions/dashboard"
import { deleteProductAction, updateProductStatusAction } from "@/app/actions/products"
import Image from "next/image"
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
import { toast } from "sonner"

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const router = useRouter()

  // Load products from Supabase using Server Action
  const loadProducts = async () => {
    try {
      setLoading(true)
      const result = await getAllProductsAdminAction()

      if (result.error) {
        toast.error(result.error)
        return
      }

      // Transform Supabase data to Product interface
      const products: Product[] = (result.data || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        logo: product.logo,
        category: product.category,
        isNew: product.is_new,
        hasUpdate: product.has_update,
        isActive: product.is_active,
        description: product.description,
        denom_icon_url: product.denom_icon_url || undefined,
        ribbon_text: product.ribbon_text || undefined,
        denominations: product.denominations || [],
        faqs: product.faqs || [],
      }))

      setProducts(products)
    } catch (error) {
      console.error("Error loading products:", error)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleEditProduct = (productId: string) => {
    router.push(`/admin/dashboard/products/${productId}`)
  }

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        // Delete the product from Supabase using Server Action
        const result = await deleteProductAction(productToDelete)

        if (result.error) {
          toast.error(result.error)
          return
        }

        // Update local state
        setProducts(products.filter((product) => product.id !== productToDelete))

        toast.success("Product deleted successfully")
      } catch (error: any) {
        console.error("Error deleting product:", error)
        toast.error(error?.message || "Failed to delete product")
      }

      setDeleteDialogOpen(false)
      setProductToDelete(null)
    }
  }

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      // Update the product status in Supabase using Server Action
      const result = await updateProductStatusAction(productId, !currentStatus)

      if (result.error) {
        toast.error(result.error)
        return
      }

      // Update local state
      setProducts(
        products.map((product) => (product.id === productId ? { ...product, isActive: !currentStatus } : product)),
      )

      toast.success(`Product ${!currentStatus ? "activated" : "deactivated"} successfully`)
    } catch (error: any) {
      console.error("Error updating product status:", error)
      toast.error(error?.message || "Failed to update product status")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
            <p className="text-[#4B5563]">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Products</h1>
          <p className="text-[#4B5563]">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadProducts}
            className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#FEF7E0]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white"
            onClick={() => router.push("/admin/dashboard/products/add")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
        <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937]">All Products ({products.length})</CardTitle>
          <CardDescription className="text-[#92400E]">View and manage all products in your store</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search products..."
              className="pl-10 bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-hidden">
            <Table>
              <TableHeader className="bg-white">
                <TableRow>
                  <TableHead className="text-[#1F2937] font-medium">Image</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Name</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Category</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Status</TableHead>
                  <TableHead className="text-[#1F2937] font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-[#FEF7E0]/50">
                    <TableCell>
                      <div className="h-10 w-10 relative rounded overflow-hidden">
                        <Image
                          src={product.logo || "/placeholder.svg"}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-[#1F2937]">{product.name}</TableCell>
                    <TableCell className="capitalize text-[#4B5563]">{product.category}</TableCell>
                    <TableCell>
                      <Badge
                        className={`cursor-pointer ${
                          product.isActive !== false
                            ? "bg-[#10B981] hover:bg-[#10B981]/90"
                            : "bg-[#EF4444] hover:bg-[#EF4444]/90"
                        } text-white font-medium`}
                        onClick={() => toggleProductStatus(product.id, product.isActive !== false)}
                      >
                        {product.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#F59E0B] hover:text-[#F59E0B]/80 hover:bg-[#FEF7E0]"
                          onClick={() => handleEditProduct(product.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#EF4444] hover:text-[#EF4444]/80 hover:bg-red-50"
                          onClick={() => handleDeleteClick(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-[#4B5563]">
                      {searchQuery ? "No products found matching your search." : "No products available."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#F59E0B]/20">
              <p className="text-sm text-[#4B5563]">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#FEF7E0] disabled:opacity-50 h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {/* Smart pagination with ellipsis */}
                {(() => {
                  const pages: (number | string)[] = []
                  const maxVisible = 5
                  
                  if (totalPages <= maxVisible + 2) {
                    // Show all pages if not too many
                    for (let i = 1; i <= totalPages; i++) pages.push(i)
                  } else {
                    // Always show first page
                    pages.push(1)
                    
                    if (currentPage <= 3) {
                      // Near start: show 2, 3, 4, ..., last
                      pages.push(2, 3, 4, '...', totalPages)
                    } else if (currentPage >= totalPages - 2) {
                      // Near end: show ..., last-3, last-2, last-1, last
                      pages.push('...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
                    } else {
                      // Middle: show ..., current-1, current, current+1, ..., last
                      pages.push('...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
                    }
                  }
                  
                  return pages.map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-[#4B5563]">...</span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page as number)}
                        className={
                          currentPage === page
                            ? "bg-[#F59E0B] text-white hover:bg-[#F59E0B]/90 h-8 w-8 p-0 text-sm"
                            : "border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#FEF7E0] h-8 w-8 p-0 text-sm"
                        }
                      >
                        {page}
                      </Button>
                    )
                  ))
                })()}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#FEF7E0] disabled:opacity-50 h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[#EF4444]" />
              Confirm Product Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#4B5563]">
              Are you sure you want to delete this product? This action cannot be undone and will remove the product
              from both the admin portal and the homepage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5E7EB] text-[#4B5563]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white" onClick={confirmDelete}>
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
