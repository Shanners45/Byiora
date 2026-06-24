import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Product } from "@/lib/product-categories"

const BASE_URL = "https://www.byiora.com.np"

interface Props {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: product } = await (supabase as any)
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single()

  const p = product as Product | null
  if (!p) {
    return { title: "Product Not Found", description: "The product you are looking for does not exist." }
  }

  const productUrl = `${BASE_URL}/en-np/${slug}`
  return {
    title: `Buy ${p.name} in Nepal | Byiora`,
    description: `Buy ${p.name} securely from Byiora with instant delivery in Nepal.`,
    alternates: { canonical: productUrl },
    openGraph: {
      title: `Buy ${p.name} in Nepal | Byiora`,
      description: `Buy ${p.name} securely from Byiora with instant delivery in Nepal.`,
      url: productUrl,
      images: p.logo ? [{ url: p.logo, width: 600, height: 600, alt: p.name }] : [],
    },
  }
}

async function HiddenTitle({ slug }: { slug: string }) {
  const supabase = await createClient()

  try {
    const { data: product } = await (supabase as any)
      .from("products")
      .select("name")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    if (product) {
      return <h1 className="sr-only">{product.name}</h1>
    }
  } catch {
    return null
  }
  return null
}

export default async function LocaleProductLayout({ children, params }: Props) {
  const { slug } = await params
  return (
    <>
      <Suspense fallback={null}>
        <HiddenTitle slug={slug} />
      </Suspense>
      {children}
    </>
  )
}

