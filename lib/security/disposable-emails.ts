 /**
 * Disposable & Burner Email Domain Filter
 * Protects Byiora from temporary, throwaway, and spam email accounts.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Domains used in recent spam attacks
  "maxxspace.com",
  "meonvr.com",
  "generator.email",
  "example.invalid",
  "maildrop.cc",
  "marchslurp.com",
  "arcadehearth.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "10minutemail.net",
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "pokemail.net",
  "spam4.me",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "dispostable.com",
  "getairmail.com",
  "mohmal.com",
  "mohmal.im",
  "mohmal.in",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "trashmail.me",
  "trash-mail.com",
  "throwawaymail.com",
  "mytemp.email",
  "fakeinbox.com",
  "tempinbox.com",
  "inboxkitten.com",
  "maildrop.cc",
  "crazymailing.com",
  "emailondeck.com",
  "minuteinbox.com",
  "burnerdns.com",
  "clipmail.eu",
  "dropmail.me",
  "fakemailgenerator.com",
  "spambog.com",
  "spambog.de",
  "spambog.ru",
  "bccto.me",
  "chacuo.net",
  "despam.it",
  "mailnesia.com",
  "meltmail.com",
  "tmail.ws",
  "zillamail.com",
  "burnermail.io",
  "incognitomail.org",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "spamevader.com",
  "tempr.email",
  "discard.im",
  "0-mail.com",
  "cloudtempmail.com",
  "tempail.com",
  "mytempmail.com",
  "inboxalias.com",
  "disposablemail.com",
  "emailfake.com",
  "fakemail.net",
  "tempinbox.xyz",
  "tempmailer.com",
  "tempmailgen.com",
  "temporary-mail.net",
  "throwawayemailaddress.com",
  "trashmail.at",
  "trashmail.io",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfemail.de",
  "mytemp.email",
  "disposable-email.net",
  "tempmailo.com",
  "internxt.com",
  "generator-mail.com",
  "vmani.com",
  "smailpro.com",
  "getnada.com",
  "abcvg.com",
  "amilegit.com",
  "crapmail.org",
  "inboxbear.com",
  "nada.ltd",
  "nada.email",

  // Domains used in Nov 2026 penetration attempts
  "euploading.com",
  "inboxes.com",
  "mail.tm",
])

/**
 * Checks if the given email address is from a known disposable/temporary domain.
 */
export function isDisposableEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false

  const clean = email.trim().toLowerCase()
  const parts = clean.split("@")
  if (parts.length !== 2) return false

  const domain = parts[1].trim()
  if (!domain) return false

  // Direct match
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return true
  }

  // Check subdomains (e.g. mail.meonvr.com -> meonvr.com)
  const domainParts = domain.split(".")
  if (domainParts.length > 2) {
    const rootDomain = domainParts.slice(-2).join(".")
    if (DISPOSABLE_DOMAINS.has(rootDomain)) {
      return true
    }
  }

  // Block orders/signups using the business's own domains or probe domains
  const blockedInternalDomains = [
    "byiora.com.np",
    "byiora.online",
    "byiora.store",
    "example.invalid",
    "example.com",
    "example.org",
  ]
  if (blockedInternalDomains.some(d => domain === d || domain.endsWith(`.${d}`))) {
    return true
  }

  return false
}

/**
 * Detects attacker-style probe emails that mimic the brand name,
 * include recon keywords, or use machine-generated timestamp usernames.
 *
 * Examples caught:
 *   byiora1795174550@euploading.com  → brand name + timestamp
 *   probe1795169291@euploading.com   → "probe" keyword
 *   qabyioraloeervtz@gmail.com       → brand name embedded
 *   byioratest74280@gmail.com        → brand name + "test"
 *   pt3145bb793@euploading.com       → short prefix + long digits
 */
export function isSuspiciousProbeEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false

  const clean = email.trim().toLowerCase()
  const parts = clean.split("@")
  if (parts.length !== 2) return false

  const userPart = parts[0]

  // 1. Contains the brand name "byiora" anywhere in the local part
  if (userPart.includes("byiora")) return true

  // 2. Contains recon keywords
  if (/(?:^|[.\-_])probe(?:[.\-_]|$|\d)/i.test(userPart)) return true

  // 3. Short alphabetic prefix (1-5 chars) followed by 10+ digits (timestamp-style)
  if (/^[a-z]{1,5}\d{10,}$/i.test(userPart)) return true

  // 4. Any mix ending with 7+ consecutive digits (machine-generated feel)
  //    but only when total length is short (avoids catching real emails)
  if (userPart.length <= 25 && /\d{7,}$/.test(userPart)) return true

  return false
}
