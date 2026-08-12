/** WhatsApp Meta 24 saat hizmet penceresi — son inbound'tan itibaren açık mı? */
export function isWhatsApp24hWindowOpen(lastInboundAt: string | null | undefined): boolean {
  if (!lastInboundAt) return false
  const diffMs = Date.now() - new Date(lastInboundAt).getTime()
  return diffMs < 24 * 60 * 60 * 1000
}
