import { API_ORIGIN } from './config';

const TOKEN_ENDPOINT = `${API_ORIGIN}/connect/token`;

const ACCESS_TOKEN_KEY = 'ccc_token';
const TOKEN_EXPIRES_AT_KEY = 'ccc_token_expires_at';
const USER_KEY = 'ccc_user';

export interface AuthUser {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface JwtPayload {
  sub?: string;
  email?: string | string[];
  role?: string | string[];
  tenant_id?: string | string[];
  tenantId?: string | string[];
  tenant_name?: string | string[];
  name?: string | string[];
  displayName?: string | string[];
  exp?: number;
  [key: string]: unknown;
}

function readClaimValue(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return typeof value === 'string' ? value : '';
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number | null;
  user: AuthUser;
}

function parseJwtPayload(token: string): JwtPayload {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Geçersiz access token.');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  return JSON.parse(atob(padded)) as JwtPayload;
}

function buildUserFromToken(token: string, tenantNameOverride?: string): AuthUser {
  const payload = parseJwtPayload(token);

  return {
    userId: String(payload.sub ?? ''),
    displayName: readClaimValue(payload.displayName ?? payload.name),
    email: readClaimValue(payload.email),
    role: readClaimValue(payload.role),
    tenantId: readClaimValue(payload.tenant_id ?? payload.tenantId),
    tenantName: tenantNameOverride ?? readClaimValue(payload.tenant_name),
  };
}

function getTokenExpiry(token: string): number | null {
  const payload = parseJwtPayload(token);
  return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
}

function readStoredValue(key: string): string | null {
  return localStorage.getItem(key);
}

function clearStoredValues(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
  localStorage.removeItem(USER_KEY);
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function writeSession(tokenResponse: TokenResponse, tenantNameOverride?: string): AuthSession {
  const accessToken = tokenResponse.access_token;
  const expiresAt = tokenResponse.expires_in
    ? Date.now() + tokenResponse.expires_in * 1000
    : getTokenExpiry(accessToken);
  const existingUser = getStoredSession()?.user;
  const user = buildUserFromToken(accessToken, tenantNameOverride ?? existingUser?.tenantName);

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (expiresAt) {
    localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt));
  } else {
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
  }

  return {
    accessToken,
    expiresAt,
    user,
  };
}

async function requestToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const rawBody = await response.text();
  const data = rawBody ? tryParseJson<TokenResponse>(rawBody) : null;

  if (!response.ok) {
    if (data) {
      throw new Error(data.error_description ?? data.error ?? 'Kimlik doğrulama başarısız');
    }

    throw new Error(rawBody || 'Kimlik doğrulama başarısız');
  }

  if (!data?.access_token) {
    throw new Error('Kimlik doğrulama yanıtı geçersiz.');
  }

  return data;
}

export function clearAuthSession(): void {
  clearStoredValues();
}

export function getStoredSession(): AuthSession | null {
  const accessToken = readStoredValue(ACCESS_TOKEN_KEY);
  const rawUser = readStoredValue(USER_KEY);

  if (!accessToken || !rawUser) {
    return null;
  }

  const parsedUser = tryParseJson<AuthUser>(rawUser);
  if (!parsedUser) {
    clearStoredValues();
    return null;
  }

  const expiresAtValue = readStoredValue(TOKEN_EXPIRES_AT_KEY);
  const expiresAt = expiresAtValue ? Number(expiresAtValue) : getTokenExpiry(accessToken);

  return {
    accessToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : getTokenExpiry(accessToken),
    user: parsedUser,
  };
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
  });

  const tokenResponse = await requestToken(params);
  return writeSession(tokenResponse, tenantName);
}

export function isAccessTokenExpired(session: AuthSession | null, thresholdMs = 30_000): boolean {
  if (!session?.expiresAt) {
    return false;
  }

  return session.expiresAt <= Date.now() + thresholdMs;
}

export async function getValidAccessToken(): Promise<string | null> {
  const session = getStoredSession();
  if (!session) {
    return null;
  }

  if (!isAccessTokenExpired(session)) {
    return session.accessToken;
  }

  clearAuthSession();
  return null;
}