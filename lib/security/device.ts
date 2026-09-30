/**
 * Enhanced device fingerprinting using FingerprintJS (open-source).
 *
 * FingerprintJS generates a stable visitor ID from browser attributes
 * (canvas, WebGL, audio, screen, fonts, timezone, etc.) that survives
 * localStorage clears and incognito mode. It's purely client-side —
 * no external network requests — so it works perfectly on Vercel.
 *
 * Flow:
 * 1. On first page load, initDeviceFingerprint() runs FingerprintJS
 *    and stores the result in localStorage as `_byiora_fp`.
 * 2. getOrCreateDeviceId() reads `_byiora_fp` if available, otherwise
 *    falls back to the basic random `_byiora_did` ID.
 * 3. All existing code that calls getOrCreateDeviceId() automatically
 *    benefits from the stronger fingerprint without any changes.
 */

let fingerprintInitialized = false

/**
 * Returns the device ID synchronously. Prefers the stronger FingerprintJS-based
 * ID if it has been initialized, otherwise falls back to a basic random ID.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return ""
  try {
    // Prefer the stronger FingerprintJS-based ID if available
    const fpId = localStorage.getItem("_byiora_fp")
    if (fpId) return fpId

    // Fallback to the basic random ID
    let id = localStorage.getItem("_byiora_did")
    if (!id) {
      id = "d_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now().toString(36)
      localStorage.setItem("_byiora_did", id)
    }
    return id
  } catch (_) {
    return ""
  }
}

/**
 * Initializes FingerprintJS and stores the visitor ID in localStorage.
 * This runs once per browser session and is idempotent — safe to call
 * multiple times (subsequent calls return the cached ID immediately).
 *
 * Should be called early in the page lifecycle (e.g. in a useEffect on
 * the product page or checkout page) so the fingerprint is ready before
 * the user clicks "Buy Now".
 */
export async function initDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return ""

  try {
    // Skip if already initialized this session
    const existing = localStorage.getItem("_byiora_fp")
    if (existing && fingerprintInitialized) return existing

    // Dynamic import to ensure FingerprintJS is never loaded server-side
    const FingerprintJS = (await import("@fingerprintjs/fingerprintjs")).default
    const fp = await FingerprintJS.load()
    const result = await fp.get()

    const visitorId = `fp_${result.visitorId}`
    localStorage.setItem("_byiora_fp", visitorId)
    fingerprintInitialized = true

    return visitorId
  } catch (_) {
    // If FingerprintJS fails for any reason, fall back to the basic ID
    return getOrCreateDeviceId()
  }
}
