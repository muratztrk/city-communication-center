import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import {
  clearAuthSession,
  exchangeInteractiveGrant,
  loginWithPassword,
  logoutSession,
  restoreSessionFromCookie,
} from '../api/auth'
import type { AuthSession, AuthUser } from '../types/platform'

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

  const signIn = async (username: string, password: string, tenantId: string, tenantName: string) => {
    const nextSession = await loginWithPassword(username, password, tenantId, tenantName)
    setSession(nextSession)
  }

  const completeInteractiveSignIn = async (username: string, password: string, tenantId: string, tenantName: string) => {
    const nextSession = await exchangeInteractiveGrant(username, password, tenantId, tenantName)
    setSession(nextSession)
  }

  const logout = async () => {
    await logoutSession()
    setSession(null)
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
