import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { applyTenantAppearance, DEFAULT_TENANT_APPEARANCE, resolveTenantAppearance } from '../lib/theme'
import type { TenantAppearance } from '../types/platform'

interface ThemeContextValue {
  appearance: TenantAppearance
  setAppearance: (appearance: Partial<TenantAppearance> | null | undefined) => void
  resetAppearance: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
  const [appearance, setAppearanceState] = useState<TenantAppearance>(DEFAULT_TENANT_APPEARANCE)

  useEffect(() => {
    applyTenantAppearance(appearance)
  }, [appearance])

  const value: ThemeContextValue = {
    appearance,
    setAppearance: nextAppearance => setAppearanceState(resolveTenantAppearance(nextAppearance)),
    resetAppearance: () => setAppearanceState(DEFAULT_TENANT_APPEARANCE),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenantTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTenantTheme must be used within ThemeProvider')
  }

  return context
}
