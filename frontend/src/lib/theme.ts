import type { TenantAppearance } from '../types/platform'

export interface ThemePresetDefinition {
  key: string
  label: string
  description: string
  appearance: Omit<TenantAppearance, 'isCustomized'>
}

export const DEFAULT_TENANT_APPEARANCE: TenantAppearance = {
  themePreset: 'tire-municipal-green',
  primaryColor: '#0A8F3E',
  secondaryColor: '#53B748',
  accentColor: '#1F2328',
  neutralColor: '#4F5B54',
  surfaceColor: '#FFFFFF',
  backgroundColor: '#F3F8F4',
  headerGradientFrom: '#0B6B36',
  headerGradientTo: '#1A1E1C',
  sidebarBackgroundColor: '#171A18',
  sidebarForegroundColor: '#F4FAF5',
  isCustomized: false,
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    key: 'tire-municipal-green',
    label: 'Tire Yeşil',
    description: 'Tire Belediyesi logosundaki yeşil ve koyu tonlara uyarlanmış tema.',
    appearance: {
      themePreset: 'tire-municipal-green',
      primaryColor: '#0A8F3E',
      secondaryColor: '#53B748',
      accentColor: '#1F2328',
      neutralColor: '#4F5B54',
      surfaceColor: '#FFFFFF',
      backgroundColor: '#F3F8F4',
      headerGradientFrom: '#0B6B36',
      headerGradientTo: '#1A1E1C',
      sidebarBackgroundColor: '#171A18',
      sidebarForegroundColor: '#F4FAF5',
    },
  },
  {
    key: 'civic-classic',
    label: 'Kurumsal Mavi',
    description: 'Resmi belediye ekranları için dengeli ve güven veren ana tema.',
    appearance: {
      themePreset: 'civic-classic',
      primaryColor: '#0B4F7A',
      secondaryColor: '#2C678F',
      accentColor: '#C59A37',
      neutralColor: '#5B6775',
      surfaceColor: '#FFFFFF',
      backgroundColor: '#F5F7FA',
      headerGradientFrom: '#103A5B',
      headerGradientTo: '#2F658D',
      sidebarBackgroundColor: '#0C2D48',
      sidebarForegroundColor: '#F8FBFD',
    },
  },
  {
    key: 'civic-contrast',
    label: 'Lacivert Kontrast',
    description: 'Yoğun veri ekranları için daha yüksek kontrast ve daha ciddi görünüm.',
    appearance: {
      themePreset: 'civic-contrast',
      primaryColor: '#123B63',
      secondaryColor: '#28587B',
      accentColor: '#C4932F',
      neutralColor: '#526170',
      surfaceColor: '#FFFFFF',
      backgroundColor: '#F3F6F9',
      headerGradientFrom: '#0E2F4B',
      headerGradientTo: '#234F74',
      sidebarBackgroundColor: '#082338',
      sidebarForegroundColor: '#F7FAFC',
    },
  },
  {
    key: 'civic-light',
    label: 'Açık Servis',
    description: 'Operatör kullanımında daha açık yüzeyler ve sade kontrast.',
    appearance: {
      themePreset: 'civic-light',
      primaryColor: '#245C86',
      secondaryColor: '#477C9F',
      accentColor: '#B68A2A',
      neutralColor: '#6A7785',
      surfaceColor: '#FFFFFF',
      backgroundColor: '#F7F9FB',
      headerGradientFrom: '#1F557C',
      headerGradientTo: '#4F83A8',
      sidebarBackgroundColor: '#143A59',
      sidebarForegroundColor: '#F7FAFC',
    },
  },
]

function resolvePresetAppearance(themePreset?: string | null) {
  return THEME_PRESETS.find(preset => preset.key === themePreset)?.appearance ?? DEFAULT_TENANT_APPEARANCE
}

export function resolveTenantAppearance(appearance?: Partial<TenantAppearance> | null): TenantAppearance {
  const presetBase = resolvePresetAppearance(appearance?.themePreset)

  return {
    ...DEFAULT_TENANT_APPEARANCE,
    ...presetBase,
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

export function applyTenantBrowserBranding(appearance: TenantAppearance): void {
  if (typeof document === 'undefined') {
    return
  }

  const iconUrl = appearance.logoUrl?.trim() || '/favicon.ico'
  const iconType = iconUrl.endsWith('.svg')
    ? 'image/svg+xml'
    : iconUrl.endsWith('.png')
      ? 'image/png'
    : iconUrl.endsWith('.jpeg') || iconUrl.endsWith('.jpg')
      ? 'image/jpeg'
    : iconUrl.endsWith('.ico')
      ? 'image/x-icon'
      : undefined
  const ensureIconLink = (rel: string) => {
    let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      document.head.appendChild(link)
    }

    link.href = iconUrl
    if (iconType) {
      link.type = iconType
    } else {
      link.removeAttribute('type')
    }
  }

  ensureIconLink('icon')
  ensureIconLink('shortcut icon')
  ensureIconLink('apple-touch-icon')
}
