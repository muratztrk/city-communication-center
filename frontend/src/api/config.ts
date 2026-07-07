function isPrivateNetworkHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return true
  }

  const parts = hostname.split('.').map(part => Number.parseInt(part, 10))
  if (parts.length === 4 && parts.every(part => Number.isFinite(part))) {
    if (parts[0] === 10) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  }

  return false
}

function resolveApiOrigin(): string {
  const configuredApiOrigin = (import.meta.env.VITE_API_ORIGIN ?? '').trim()

  if (typeof window === 'undefined') {
    return configuredApiOrigin || 'http://localhost:15000'
  }

  const pageOrigin = window.location.origin
  const pageHost = window.location.hostname
  const pageIsPublicHttps = window.location.protocol === 'https:' && !isPrivateNetworkHost(pageHost)

  if (configuredApiOrigin) {
    try {
      const configuredHost = new URL(configuredApiOrigin).hostname
      // VPN/public domain üzerinden erişimde build-time LAN API adresi tarayıcı yerel ağ izni istemesin (card #1442 reopen).
      if (pageIsPublicHttps && isPrivateNetworkHost(configuredHost)) {
        return pageOrigin
      }
    } catch {
      // ignore malformed configured origin
    }
    return configuredApiOrigin
  }

  if (pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
    return pageOrigin
  }

  return 'http://localhost:15000'
}

export const API_ORIGIN = resolveApiOrigin()
export const API_BASE = `${API_ORIGIN}/api/v1`

// Ekler /uploads/... şeklinde göreli URL ile döner; API ile frontend farklı origin'de
// olduğunda <img>/link kırılmasın diye API_ORIGIN ile mutlak hale getir (card 538).
export function resolveAttachmentUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (/^(https?:|blob:|data:)/i.test(url)) return url
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

// Per-deployment tenant ID. Set VITE_TENANT_ID at build time to lock this frontend
// to a specific tenant (single-tenant deployment model). When not set, the login
// page falls back to host-based or manual tenant selection.
export const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? '').trim()
