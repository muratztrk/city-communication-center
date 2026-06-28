import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import {
  clearAuthSession,
  exchangeInteractiveGrant,
  loginWithPassword,
  logoutSession,
  restoreSessionFromCookie,
} from '../api/auth'
import {
  clearUsePrimaryDepartmentOnLoad,
  markUsePrimaryDepartmentOnNextLoad,
  SESSION_EXPIRED_EVENT,
  setActiveDepartmentId,
} from '../api/http'
import type { AuthSession, AuthUser } from '../types/platform'

// Sekmeler arası gerçek logout sinyali için ayrılmış localStorage anahtarı.
const LOGOUT_BROADCAST_KEY = 'ccc_logout_broadcast'

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  session: AuthSession | null
  user: AuthUser | null
  signIn: (username: string, password: string, tenantId: string, tenantName: string) => Promise<void>
  completeInteractiveSignIn: (username: string, password: string, tenantId: string, tenantName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    restoreSessionFromCookie()
      .then(restoredSession => {
        if (isMounted) {
          setSession(restoredSession)
        }
      })
      .catch(() => {
        clearAuthSession()
        if (isMounted) {
          setSession(null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Oturum başka bir sekmede GERÇEKTEN kapatıldığında (logout) ya da bir istek 401
  // döndüğünde bu sekmeyi de login ekranına düşür. Yalnızca özel logout sinyalini
  // dinleriz; başka sekmenin açılışında storage'ın geçici değişmesi oturumu DÜŞÜRMEZ.
  useEffect(() => {
    const handleSessionExpired = () => setSession(null)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_BROADCAST_KEY && event.newValue) {
        setSession(null)
      }
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const establishSession = async (nextSession: AuthSession) => {
    markUsePrimaryDepartmentOnNextLoad()
    setActiveDepartmentId(null, true)
    if (nextSession.user.departmentId) {
      setActiveDepartmentId(nextSession.user.departmentId, true)
    }
    setSession(nextSession)
  }

  const signIn = async (username: string, password: string, tenantId: string, tenantName: string) => {
    const nextSession = await loginWithPassword(username, password, tenantId, tenantName)
    await establishSession(nextSession)
  }

  const completeInteractiveSignIn = async (username: string, password: string, tenantId: string, tenantName: string) => {
    const nextSession = await exchangeInteractiveGrant(username, password, tenantId, tenantName)
    await establishSession(nextSession)
  }

  const logout = async () => {
    setActiveDepartmentId(null, true)
    clearUsePrimaryDepartmentOnLoad()
    await logoutSession()
    setSession(null)
    // Diğer sekmelere gerçek logout sinyali gönder.
    try { localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now())) } catch { /* yok say */ }
  }

  const value: AuthContextValue = {
    isAuthenticated: !!session,
    isLoading,
    session,
    user: session?.user ?? null,
    signIn,
    completeInteractiveSignIn,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
