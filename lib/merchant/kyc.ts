// Shared by the browser KYC form and the server checks.

export const KYC_DOC_TYPES = {
  registration_certificate: "Company / firm registration certificate",
  pan_certificate: "PAN / VAT certificate",
  owner_id: "Owner's citizenship or passport",
  other: "Other supporting document",
} as const
export type KycDocType = keyof typeof KYC_DOC_TYPES
export const REQUIRED_KYC_DOCS: KycDocType[] = ["registration_certificate", "pan_certificate", "owner_id"]
export const KYC_MAX_BYTES = 5 * 1024 * 1024
export const KYC_MIME = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const

/** File type from its first bytes; the browser-declared type is not trusted. */
export function sniffMime(bytes: Uint8Array): keyof typeof KYC_MIME | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  return null
}
