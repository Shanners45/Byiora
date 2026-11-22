// Merchant portal sessions live in their own cookie so a merchant sign-in never
// replaces an admin or customer session in the same browser (e.g. on localhost).
export const MERCHANT_AUTH_COOKIE = "sb-merchant-auth-token"
