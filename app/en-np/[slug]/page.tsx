import ProductDetailPage from "./product-client"
import { getProduct } from "./get-product"
import { mapProductRow } from "@/lib/product-categories"

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // The layout already 404s unknown slugs; a DB hiccup falls back to the browser fetch.
  const row = await getProduct(slug).catch(() => null)
  return <ProductDetailPage initialProduct={row ? mapProductRow(row) : null} />
}
