import i18n from '../i18n'
import { clearAuthSession, getStoredSession, getValidAccessToken } from './auth'

const ACTIVE_DEPARTMENT_KEY = 'ccc_active_department_v2'
const LEGACY_ACTIVE_DEPARTMENT_KEY = 'ccc_active_department_id'
const USE_PRIMARY_DEPARTMENT_KEY = 'ccc_use_primary_department'

type ActiveDepartmentState = {
  userId: string
  departmentId: string
}

function readCurrentUserId(): string | null {
  return getStoredSession()?.user?.userId ?? null
}

function removeLegacyActiveDepartmentKey(): void {
  window.localStorage.removeItem(LEGACY_ACTIVE_DEPARTMENT_KEY)
}

export function markUsePrimaryDepartmentOnNextLoad(): void {
  window.sessionStorage.setItem(USE_PRIMARY_DEPARTMENT_KEY, '1')
}

export function shouldUsePrimaryDepartmentOnLoad(): boolean {
  return window.sessionStorage.getItem(USE_PRIMARY_DEPARTMENT_KEY) === '1'
}

export function clearUsePrimaryDepartmentOnLoad(): void {
  window.sessionStorage.removeItem(USE_PRIMARY_DEPARTMENT_KEY)
}

// Oturum başka bir sekmede sonlandığında (logout) ya da sunucu 401 döndüğünde
// tüm sekmelerin login ekranına düşmesi için yayınlanan olay.
export const SESSION_EXPIRED_EVENT = 'ccc:session-expired'

function notifySessionExpired(): void {
  clearAuthSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
}

export function getActiveDepartmentId(userId?: string | null): string | null {
  const expectedUserId = userId ?? readCurrentUserId()
  if (!expectedUserId) {
    return null
  }

  const raw = window.localStorage.getItem(ACTIVE_DEPARTMENT_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ActiveDepartmentState
      if (parsed.userId === expectedUserId && parsed.departmentId) {
        return parsed.departmentId
      }
    } catch {
      // ignore malformed cache
    }
  }

  // Eski sürümde kullanıcıya bağlı olmayan anahtar; yeni oturumda yok sayılır.
  removeLegacyActiveDepartmentKey()
  return null
}

export function setActiveDepartmentId(departmentId: string | null, silent = false, userId?: string | null): void {
  const resolvedUserId = userId ?? readCurrentUserId()
  removeLegacyActiveDepartmentKey()

  if (!resolvedUserId) {
    window.localStorage.removeItem(ACTIVE_DEPARTMENT_KEY)
  } else if (departmentId) {
    const payload: ActiveDepartmentState = {
      userId: resolvedUserId,
      departmentId,
    }
    window.localStorage.setItem(ACTIVE_DEPARTMENT_KEY, JSON.stringify(payload))
  } else {
    const raw = window.localStorage.getItem(ACTIVE_DEPARTMENT_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ActiveDepartmentState
        if (parsed.userId === resolvedUserId) {
          window.localStorage.removeItem(ACTIVE_DEPARTMENT_KEY)
        }
      } catch {
        window.localStorage.removeItem(ACTIVE_DEPARTMENT_KEY)
      }
    }
  }

  if (!silent) {
    window.dispatchEvent(new CustomEvent('activeDepartmentChanged'))
  }
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getValidAccessToken()
  const tenantId = getStoredSession()?.user.tenantId ?? null
  const activeDepartmentId = getActiveDepartmentId()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
  }

  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (activeDepartmentId) {
    headers['X-Active-Department-Id'] = activeDepartmentId
  }

  return headers
}

export async function fetchWithCredentials(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
  })
}

export async function getErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const responseText = await response.text()
  if (!responseText) {
    return fallbackMessage
  }

  try {
    const payload = JSON.parse(responseText) as {
      title?: string
      detail?: string
      message?: string
      error?: string
      error_description?: string
      errors?: Record<string, string[]>
    }

    const validationMessages = payload.errors
      ? Object.values(payload.errors).flat().filter(Boolean)
      : []

    if (validationMessages.length > 0) {
      return Array.from(new Set(validationMessages)).join('\n')
    }

    return payload.detail
      ?? payload.error_description
      ?? payload.message
      ?? payload.error
      ?? payload.title
      ?? fallbackMessage
  } catch {
    return responseText || fallbackMessage
  }
}

export async function ensureOk(response: Response, fallbackMessage: string): Promise<Response> {
  if (response.status === 401) {
    notifySessionExpired()
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackMessage))
  }

  return response
}
