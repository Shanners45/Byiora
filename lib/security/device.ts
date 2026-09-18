export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return ""
  try {
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
