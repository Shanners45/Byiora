export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured")
    return false
  }

  if (!token) return false

  try {
    const body = new URLSearchParams()
    body.set("secret", secret)
    body.set("response", token)
    if (remoteIp) body.set("remoteip", remoteIp)

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    })

    if (!response.ok) return false
    const json = (await response.json()) as { success?: boolean }
    return json.success === true
  } catch (error) {
    console.error("Turnstile verification failed:", error)
    return false
  }
}

