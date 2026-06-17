const configuredApiOrigin = (import.meta.env.VITE_API_ORIGIN ?? '').trim()

const runtimeOrigin = typeof window !== 'undefined'
  && window.location.hostname !== 'localhost'
  && window.location.hostname !== '127.0.0.1'
  ? window.location.origin
  : 'http://localhost:15000'

export const API_ORIGIN = configuredApiOrigin || runtimeOrigin
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
