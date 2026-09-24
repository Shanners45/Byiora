import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "d1e6cf9fdbca402cbe2a01a9d2d331aa"
export const SITE_HOST = "www.byiora.com.np"
export const BASE_URL = `https://${SITE_HOST}`
export const KEY_LOCATION = `${BASE_URL}/${INDEXNOW_KEY}.txt`

/**
 * Submits a list of URLs to the IndexNow protocol (pings Bing, Yandex, etc.)
 */
export async function submitToIndexNow(urls: string[]): Promise<{
  success: boolean
  submittedCount: number
  error?: string
}> {
  if (!urls || urls.length === 0) {
    return { success: true, submittedCount: 0 }
  }

  // Normalize and deduplicate URLs
  const cleanUrls = Array.from(
    new Set(
      urls
        .map((u) => u.trim())
        .filter((u) => u.startsWith(BASE_URL) || u.startsWith("https://byiora.com.np"))
        .map((u) => (u.startsWith("https://byiora.com.np") ? u.replace("https://byiora.com.np", BASE_URL) : u))
    )
  )

  if (cleanUrls.length === 0) {
    return { success: false, submittedCount: 0, error: "No valid site URLs to submit" }
  }

  const payload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: cleanUrls,
  }

  try {
    // 1. Submit to the universal IndexNow endpoint (distributes to all engines)
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    })

    // IndexNow returns 200 OK or 202 Accepted
    const isSuccess = res.status === 200 || res.status === 202

    if (!isSuccess) {
      const errText = await res.text().catch(() => "")
      console.warn(`[IndexNow] api.indexnow.org returned status ${res.status}:`, errText)
    }

    // 2. Direct secondary ping to Bing IndexNow for guaranteed immediate delivery
    fetch("https://www.bing.com/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn("[IndexNow] Direct Bing ping failed:", e.message))

    return {
      success: isSuccess,
      submittedCount: cleanUrls.length,
      error: isSuccess ? undefined : `IndexNow returned status ${res.status}`,
    }
  } catch (error: any) {
    console.error("[IndexNow] Submission failed:", error)
    return {
      success: false,
      submittedCount: 0,
      error: error.message || "Failed to connect to IndexNow API",
    }
  }
}

/**
 * Gathers all active pages (home, categories, products) and submits them all to IndexNow
 */
export async function submitAllSiteUrlsToIndexNow(): Promise<{
  success: boolean
  submittedCount: number
  urls: string[]
  error?: string
}> {
  const staticUrls = [
    BASE_URL,
    `${BASE_URL}/category/topup`,
    `${BASE_URL}/category/digital-goods`,
    `${BASE_URL}/category/games`,
    `${BASE_URL}/category/direct-login`,
    `${BASE_URL}/contact`,
    `${BASE_URL}/terms-and-conditions`,
    `${BASE_URL}/privacy-policy`,
    `${BASE_URL}/refund-policy`,
  ]

  let productUrls: string[] = []
  try {
    const supabase = createServiceRoleClient()
    const { data: products } = await supabase
      .from("products")
      .select("slug")
      .eq("is_active", true)

    if (products && products.length > 0) {
      productUrls = products.map((p) => `${BASE_URL}/en-np/${p.slug}`)
    }
  } catch (err) {
    console.warn("[IndexNow] Could not fetch products for batch submission:", err)
  }

  const allUrls = [...staticUrls, ...productUrls]
  const result = await submitToIndexNow(allUrls)

  return {
    ...result,
    urls: allUrls,
  }
}
