import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, tenantId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('ccc_token');
    const storedUser = localStorage.getItem('ccc_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string, tenantId: string) => {
    const response = await fetch('http://localhost:5100/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, tenantId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Giriş başarısız');
    }

    const data = await response.json();
    
    const userData: User = {
      userId: data.userId,
      displayName: data.displayName,
      email: data.email,
      role: data.role,
      tenantId: data.tenantId,
      tenantName: data.tenantName,
    };

    setToken(data.token);
    setUser(userData);
    
    localStorage.setItem('ccc_token', data.token);
    localStorage.setItem('ccc_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ccc_token');
    localStorage.removeItem('ccc_user');
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
