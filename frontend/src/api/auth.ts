import { API_BASE, API_ORIGIN, TENANT_ID } from './config'
import i18n from '../i18n'
import { parseRolePageAccessMatrix, saveRolePageAccessMatrix } from '../lib/rolePageAccess'
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
const SESSION_LOGIN_ENDPOINT = `${API_BASE}/auth/session/login`
const SESSION_LOGOUT_ENDPOINT = `${API_BASE}/auth/session/logout`
const SESSION_ME_ENDPOINT = `${API_BASE}/auth/session/me`

const ACCESS_TOKEN_KEY = 'ccc_token'
const TOKEN_EXPIRES_AT_KEY = 'ccc_token_expires_at'
const USER_KEY = 'ccc_user'

interface TokenResponse {
  access_token: string
  expires_in?: number
  error?: string
  error_description?: unknown
}

interface LoginResponse {
  userId: string
  username: string | null
  displayName: string
  email: string | null
  role: string
  tenantId: string
  tenantName: string
  authenticationMode: string
}

interface AuthenticatedUserProfileResponse {
  userId: string | null
  email: string | null
  displayName: string | null
  role: string | null
  tenantId: string | null
  departmentId: string | null
  departmentName: string | null
  rolePageAccessJson: string | null
  userSource: string | null
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
  department_id?: string | string[]
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
    departmentId: readClaimValue(payload.department_id),
  }
}

function buildUserFromLoginResponse(response: LoginResponse): AuthUser {
  return {
    userId: response.userId,
    username: response.username ?? '',
    displayName: response.displayName,
    email: response.email ?? '',
    role: response.role,
    tenantId: response.tenantId,
    tenantName: response.tenantName,
    departmentId: '',
  }
}

function buildUserFromProfileResponse(response: AuthenticatedUserProfileResponse, existingUser?: AuthUser | null): AuthUser {
  return {
    userId: response.userId ?? '',
    username: existingUser?.username ?? '',
    displayName: response.displayName ?? existingUser?.displayName ?? '',
    email: response.email ?? existingUser?.email ?? '',
    role: response.role ?? existingUser?.role ?? '',
    tenantId: response.tenantId ?? existingUser?.tenantId ?? '',
    tenantName: existingUser?.tenantName ?? '',
    departmentId: response.departmentId ?? existingUser?.departmentId ?? '',
    departmentName: response.departmentName ?? existingUser?.departmentName ?? '',
    userSource: response.userSource ?? existingUser?.userSource ?? '',
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

function writeCookieSession(user: AuthUser): AuthSession {
  clearStoredValues()
  localStorage.setItem(USER_KEY, JSON.stringify(user))

  return {
    accessToken: null,
    expiresAt: null,
    user,
  }
}

function syncRolePageAccess(value: string | null | undefined): void {
  const matrix = parseRolePageAccessMatrix(value)
  if (matrix) {
    saveRolePageAccessMatrix(matrix)
  }
}

async function requestJson<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
      ...(init.headers ?? {}),
    },
  })

  const rawBody = await response.text()
  const data = rawBody ? tryParseJson<T>(rawBody) : null

  if (!response.ok) {
    if (data) {
      const payload = data as { error?: unknown; error_description?: unknown; message?: unknown; detail?: unknown }
      throw new Error(
        readErrorMessage(payload.error_description)
        || readErrorMessage(payload.message)
        || readErrorMessage(payload.detail)
        || readErrorMessage(payload.error)
        || fallbackMessage,
      )
    }

    throw new Error(rawBody || fallbackMessage)
  }

  if (!data) {
    throw new Error(i18n.t('errors.invalidAuthResponse'))
  }

  return data
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

  if (!rawUser) {
    return null
  }

  const parsedUser = tryParseJson<AuthUser>(rawUser)
  if (!parsedUser) {
    clearStoredValues()
    return null
  }

  let user: AuthUser
  if (accessToken) {
    // Always rebuild user from legacy stored tokens so encoding fixes apply immediately.
    // Keep tenantName from stored user since it may come from a login-time override.
    try {
      user = buildUserFromToken(accessToken, parsedUser.tenantName)
    } catch {
      user = parsedUser
    }
  } else {
    user = parsedUser
  }

  const expiresAtValue = readStoredValue(TOKEN_EXPIRES_AT_KEY)
  const expiresAt = expiresAtValue ? Number(expiresAtValue) : accessToken ? getTokenExpiry(accessToken) : null

  return {
    accessToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : accessToken ? getTokenExpiry(accessToken) : null,
    user,
  }
}

export async function restoreSessionFromCookie(): Promise<AuthSession | null> {
  const existingUser = getStoredSession()?.user ?? null
  const response = await fetch(SESSION_ME_ENDPOINT, {
    headers: {
      'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
    },
    credentials: 'include',
  })

  if (response.status === 401 || response.status === 403) {
    clearStoredValues()
    return null
  }

  if (!response.ok) {
    throw new Error(i18n.t('errors.authFailed'))
  }

  const profile = await response.json() as AuthenticatedUserProfileResponse
  syncRolePageAccess(profile.rolePageAccessJson)
  return writeCookieSession(buildUserFromProfileResponse(profile, existingUser))
}

export async function loginWithPassword(
  username: string,
  password: string,
  tenantId: string,
  tenantName: string,
): Promise<AuthSession> {
  const response = await requestJson<LoginResponse>(SESSION_LOGIN_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      tenantId,
    }),
  }, i18n.t('errors.authFailed'))

  const user = buildUserFromLoginResponse({ ...response, tenantName: response.tenantName || tenantName })
  writeCookieSession(user)
  return await restoreSessionFromCookie() ?? writeCookieSession(user)
}

export async function loginWithPasswordToken(
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

export async function logoutSession(): Promise<void> {
  try {
    await fetch(SESSION_LOGOUT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
      },
    })
  } finally {
    clearAuthSession()
  }
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
