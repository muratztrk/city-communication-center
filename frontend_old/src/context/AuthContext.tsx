/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  clearAuthSession,
  getStoredSession,
  isAccessTokenExpired,
  loginWithPassword,
  type AuthUser,
} from '../api/auth';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, tenantId: string, tenantName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedSession = getStoredSession();
      if (!storedSession) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      const session = isAccessTokenExpired(storedSession)
        ? null
        : storedSession;

      if (!session) {
        clearAuthSession();
      }

      if (isMounted && session) {
        setToken(session.accessToken);
        setUser(session.user);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (username: string, password: string, tenantId: string, tenantName: string) => {
    const session = await loginWithPassword(username, password, tenantId, tenantName);

    setToken(session.accessToken);
    setUser(session.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearAuthSession();
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
