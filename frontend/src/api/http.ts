import i18n from '../i18n'
import { getStoredSession, getValidAccessToken } from './auth'

export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getValidAccessToken()
  const tenantId = getStoredSession()?.user.tenantId ?? null

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

  return headers
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
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackMessage))
  }

  return response
}
