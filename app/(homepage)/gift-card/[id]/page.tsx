import { permanentRedirect } from "next/navigation"
import { getProductById } from "@/lib/product-categories"

export default async function OldGiftCardPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id)

  if (product) {
    permanentRedirect(`/${product.category}/${product.slug}`)
  }

  // If product not found by ID, redirect to homepage
  permanentRedirect("/")
}
