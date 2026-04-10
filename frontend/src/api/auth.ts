import { API_BASE, API_ORIGIN, TENANT_ID } from './config'
import i18n from '../i18n'
import type {
  AuthSession,
  AuthUser,
  StartInteractiveAuthenticationResult,
  TenantLoginContext,
  VerifyInteractiveAuthenticationResult,
} from '../types/platform'

const TOKEN_ENDPOINT = `${API_ORIGIN}/connect/token`
const TENANT_CONTEXT_ENDPOINT = `${API_BASE}/auth/tenant-context`
const INTERACTIVE_START_ENDPOINT = `${API_BASE}/auth/interactive/start`
const INTERACTIVE_VERIFY_ENDPOINT = `${API_BASE}/auth/interactive/verify`

const ACCESS_TOKEN_KEY = 'ccc_token'
const TOKEN_EXPIRES_AT_KEY = 'ccc_token_expires_at'
const USER_KEY = 'ccc_user'

interface TokenResponse {
  access_token: string
  expires_in?: number
  error?: string
  error_description?: unknown
}

interface JwtPayload {
  sub?: string
  preferred_username?: string | string[]
  email?: string | string[]
  role?: string | string[]
  tenant_id?: string | string[]
  tenantId?: string | string[]
  tenant_name?: string | string[]
  name?: string | string[]
  displayName?: string | string[]
  exp?: number
  [key: string]: unknown
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function readClaimValue(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }

  return typeof value === 'string' ? value : ''
}

function readErrorMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object') {
    const objectValue = value as { value?: unknown; message?: unknown; detail?: unknown }
    if (typeof objectValue.value === 'string') {
      return objectValue.value
    }

    if (typeof objectValue.message === 'string') {
      return objectValue.message
    }

    if (typeof objectValue.detail === 'string') {
      return objectValue.detail
    }
  }

  return ''
}

function parseJwtPayload(token: string): JwtPayload {
  const [, payload] = token.split('.')
  if (!payload) {
    throw new Error(i18n.t('errors.invalidAccessToken'))
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload
}

function buildUserFromToken(token: string, tenantNameOverride?: string): AuthUser {
  const payload = parseJwtPayload(token)

  return {
    userId: String(payload.sub ?? ''),
    username: readClaimValue(payload.preferred_username),
    displayName: readClaimValue(payload.displayName ?? payload.name),
    email: readClaimValue(payload.email),
    role: readClaimValue(payload.role),
    tenantId: readClaimValue(payload.tenant_id ?? payload.tenantId),
    tenantName: tenantNameOverride ?? readClaimValue(payload.tenant_name),
  }
}

function getTokenExpiry(token: string): number | null {
  const payload = parseJwtPayload(token)
  return typeof payload.exp === 'number' ? payload.exp * 1000 : null
}

function readStoredValue(key: string): string | null {
  return localStorage.getItem(key)
}

function clearStoredValues(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
  localStorage.removeItem(USER_KEY)
}

function writeSession(tokenResponse: TokenResponse, tenantNameOverride?: string): AuthSession {
  const accessToken = tokenResponse.access_token
  const expiresAt = tokenResponse.expires_in
    ? Date.now() + tokenResponse.expires_in * 1000
    : getTokenExpiry(accessToken)
  const existingUser = getStoredSession()?.user
  const user = buildUserFromToken(accessToken, tenantNameOverride ?? existingUser?.tenantName)

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))

  if (expiresAt) {
    localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt))
  } else {
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
  }

  return {
    accessToken,
    expiresAt,
    user,
  }
}

async function requestToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const rawBody = await response.text()
  const data = rawBody ? tryParseJson<TokenResponse>(rawBody) : null

  if (!response.ok) {
    if (data) {
      const errorDescription = readErrorMessage(data.error_description)
      throw new Error(errorDescription || data.error || i18n.t('errors.authFailed'))
    }

    throw new Error(rawBody || i18n.t('errors.authFailed'))
  }

  if (!data?.access_token) {
    throw new Error(i18n.t('errors.invalidAuthResponse'))
  }

  return data
}

async function requestInteractiveResponse<T>(url: string, payload: object): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  const data = rawBody ? tryParseJson<T>(rawBody) : null

  if (response.status === 401 && !data) {
    throw new Error('NEGOTIATE_CHALLENGE')
  }

  if (!response.ok) {
    throw new Error(rawBody || i18n.t('errors.authFailed'))
  }

  if (!data) {
    throw new Error(i18n.t('errors.invalidAuthResponse'))
  }

  return data
}

export function clearAuthSession(): void {
  clearStoredValues()
}

export function getStoredSession(): AuthSession | null {
  const accessToken = readStoredValue(ACCESS_TOKEN_KEY)
  const rawUser = readStoredValue(USER_KEY)

  if (!accessToken || !rawUser) {
    return null
  }

  const parsedUser = tryParseJson<AuthUser>(rawUser)
  if (!parsedUser) {
    clearStoredValues()
    return null
  }

  // Always rebuild user from the token so encoding fixes apply immediately.
  // Keep tenantName from stored user since it may come from a login-time override.
  let user: AuthUser
  try {
    user = buildUserFromToken(accessToken, parsedUser.tenantName)
  } catch {
    user = parsedUser
  }

  const expiresAtValue = readStoredValue(TOKEN_EXPIRES_AT_KEY)
  const expiresAt = expiresAtValue ? Number(expiresAtValue) : getTokenExpiry(accessToken)

  return {
    accessToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : getTokenExpiry(accessToken),
    user,
  }
}

export async function loginWithPassword(
  username: string,
  password: string,
  tenantId: string,
  tenantName: string,
): Promise<AuthSession> {
  const params = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    tenant_id: tenantId,
  })

  const tokenResponse = await requestToken(params)
  return writeSession(tokenResponse, tenantName)
}

export async function exchangeInteractiveGrant(
  username: string,
  password: string,
  tenantId: string,
  tenantName: string,
): Promise<AuthSession> {
  return loginWithPassword(username, password, tenantId, tenantName)
}

export async function getTenantLoginContext(): Promise<TenantLoginContext> {
  const headers: HeadersInit = {
    'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
  }

  if (TENANT_ID) {
    headers['X-Tenant-Id'] = TENANT_ID
  }

  const response = await fetch(TENANT_CONTEXT_ENDPOINT, {
    headers,
    credentials: 'include',
  })

  const rawBody = await response.text()
  const data = rawBody ? tryParseJson<TenantLoginContext>(rawBody) : null

  if (!response.ok || !data) {
    throw new Error(i18n.t('errors.tenantLoadFailed'))
  }

  return data
}

export async function startInteractiveAuthentication(
  tenantId?: string,
  username?: string,
  password?: string,
): Promise<StartInteractiveAuthenticationResult> {
  try {
    return await requestInteractiveResponse<StartInteractiveAuthenticationResult>(INTERACTIVE_START_ENDPOINT, {
      tenantId: tenantId?.trim() || null,
      username: username?.trim() || null,
      password: password || null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NEGOTIATE_CHALLENGE') {
      return {
        status: 'CredentialsRequired',
        isTrustedNetwork: true,
        secondFactorRequiredOnSuccess: false,
        automaticSignInMode: 'Negotiate',
        authenticationMode: null,
        challengeId: null,
        deliveryDestination: null,
        message: null,
        expiresAtUtc: null,
        grant: null,
        mockCodePreview: null,
        challengeWithNegotiate: false,
      }
    }

    throw error
  }
}

export async function verifyInteractiveAuthentication(
  tenantId: string,
  challengeId: string,
  code: string,
): Promise<VerifyInteractiveAuthenticationResult> {
  return requestInteractiveResponse<VerifyInteractiveAuthenticationResult>(INTERACTIVE_VERIFY_ENDPOINT, {
    tenantId,
    challengeId,
    code,
  })
}

export function isAccessTokenExpired(session: AuthSession | null, thresholdMs = 30_000): boolean {
  if (!session?.expiresAt) {
    return false
  }

  return session.expiresAt <= Date.now() + thresholdMs
}

export async function getValidAccessToken(): Promise<string | null> {
  const session = getStoredSession()
  if (!session) {
    return null
  }

  if (!isAccessTokenExpired(session)) {
    return session.accessToken
  }

  clearAuthSession()
  return null
}
