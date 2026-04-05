import type { TenantAppearance } from '../types/platform'

export const DEFAULT_TENANT_APPEARANCE: TenantAppearance = {
  themePreset: 'tire-civic',
  primaryColor: '#0F4C81',
  secondaryColor: '#2B6EA6',
  accentColor: '#C6932D',
  neutralColor: '#6A7786',
  surfaceColor: '#FFFFFF',
  backgroundColor: '#EEF3F8',
  headerGradientFrom: '#123B63',
  headerGradientTo: '#356F99',
  sidebarBackgroundColor: '#102F4A',
  sidebarForegroundColor: '#F6F8FB',
  isCustomized: false,
}

export function resolveTenantAppearance(appearance?: Partial<TenantAppearance> | null): TenantAppearance {
  return {
    ...DEFAULT_TENANT_APPEARANCE,
    ...appearance,
    isCustomized: appearance?.isCustomized ?? DEFAULT_TENANT_APPEARANCE.isCustomized,
  }
}

export function applyTenantAppearance(appearance: TenantAppearance): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.style.setProperty('--color-primary', appearance.primaryColor)
  root.style.setProperty('--color-secondary', appearance.secondaryColor)
  root.style.setProperty('--color-accent', appearance.accentColor)
  root.style.setProperty('--color-neutral', appearance.neutralColor)
  root.style.setProperty('--color-surface', appearance.surfaceColor)
  root.style.setProperty('--color-background', appearance.backgroundColor)
  root.style.setProperty('--color-header-from', appearance.headerGradientFrom)
  root.style.setProperty('--color-header-to', appearance.headerGradientTo)
  root.style.setProperty('--color-sidebar', appearance.sidebarBackgroundColor)
  root.style.setProperty('--color-sidebar-foreground', appearance.sidebarForegroundColor)
  root.dataset.themePreset = appearance.themePreset
}
