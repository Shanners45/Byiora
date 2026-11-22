/**
 * When QStash re-checks an unpaid dynamic-QR payment with the bank (customer checkout and
 * merchant wallet top-ups). The Fonepay WebSocket is the primary confirmation and normally
 * wins well before the first check; these only catch payments whose WebSocket event was missed.
 */
export const SAFETY_NET_CHECKS = ["60s", "150s", "240s"] as const
