import { BrandLoader } from "@/components/brand-loader"

// Without this, the storefront's purple app/loading.tsx shows here while a page loads.
export default function Loading() {
  return <BrandLoader />
}
