/**
 * Tarayıcının "yerel ağ" (Local Network Access) saydığı adresler. Herkese açık bir sayfadan
 * buraya istek atılırsa Chrome "Yerel ağınızdaki diğer cihazlara erişin" izni sorar (#6a6e1900).
 */
function isPrivateNetworkHost(hostname: string): boolean {
  // IPv6 host'ları `[::1]` biçiminde gelir.
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (host === 'localhost' || host === '0.0.0.0' || host === '::' || host === '::1') return true
  if (/(^|\.)(local|localhost|internal|lan|intranet|home\.arpa)$/.test(host)) return true
  // IPv6 unique-local (fc00::/7) ve link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return true

  // Katı IPv4: `192.168.0.1example` gibi DNS host'ları sayısal sanılmasın (parseInt kırpardı).
  const labels = host.split('.')
  const parts = labels.map(label => (/^\d{1,3}$/.test(label) ? Number(label) : Number.NaN))
  if (parts.length === 4 && parts.every(part => Number.isFinite(part) && part <= 255)) {
    if (parts[0] === 10) return true
    if (parts[0] === 127) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 169 && parts[1] === 254) return true
    // CGNAT 100.64.0.0/10 — bazı VPN'ler bu aralığı kullanır.
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true
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
  // Sayfanın kendisi herkese açık bir adreste mi? Şema (http/https) belirleyici DEĞİL: Chrome
  // Local Network Access iznini TLS'e değil adres uzayına bakarak sorar. Eskiden yalnız https
  // sayfalarda korunuyorduk; SSL VPN arkasındaki http erişimde izin kutusu yine çıkıyordu
  // (card #1442 reopen → #6a6e1900).
  const pageIsPublicHost = !isPrivateNetworkHost(pageHost)

  if (configuredApiOrigin) {
    try {
      const configuredHost = new URL(configuredApiOrigin).hostname
      // Herkese açık sayfadan build-time LAN API adresine istek atma; aynı origin'e düş.
      // Bu geri düşüş sayfanın origin'inin /api, /connect ve /hubs'ı proxy'lemesine dayanır
      // (dağıtımdaki nginx yapar). Sessiz kalmasın: yanlış yapılandırmada tek satırda görünsün.
      if (pageIsPublicHost && isPrivateNetworkHost(configuredHost)) {
        console.warn(
          `[ccc] VITE_API_ORIGIN (${configuredApiOrigin}) yerel ağ adresi; herkese açık ${pageOrigin} `
          + 'sayfasından çağrılmıyor. İstekler aynı origin\'e yönlendirildi — bu origin /api, /connect '
          +'ve /hubs yollarını proxy\'lemiyorsa API çağrıları başarısız olur.',
        )
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
