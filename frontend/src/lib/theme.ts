import type { TenantAppearance } from '../types/platform'

export interface ThemePresetDefinition {
  key: string
  label: string
  description: string
  appearance: Omit<TenantAppearance, 'isCustomized'>
}

export const DEFAULT_TENANT_APPEARANCE: TenantAppearance = {
  themePreset: 'varsayılan-tema',
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
    key: 'varsayılan-tema',
    label: 'Varsayılan Tema',
    description: 'Yeşil ve koyu tonlara uyarlanmış varsayılan tema.',
    appearance: {
      themePreset: 'varsayılan-tema',
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

function hexToHsl(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  const r = ((value >> 16) & 255) / 255
  const g = ((value >> 8) & 255) / 255
  const b = (value & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)); break
    case g: h = (b - r) / d + 2; break
    default: h = (r - g) / d + 4; break
  }
  return [h * 60, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = Math.min(100, Math.max(0, s)) / 100
  const lNorm = Math.min(100, Math.max(0, l)) / 100
  const hNorm = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1))
  const m = lNorm - c / 2
  let [r, g, b] = [0, 0, 0]
  if (hNorm < 60) [r, g, b] = [c, x, 0]
  else if (hNorm < 120) [r, g, b] = [x, c, 0]
  else if (hNorm < 180) [r, g, b] = [0, c, x]
  else if (hNorm < 240) [r, g, b] = [0, x, c]
  else if (hNorm < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Görünüm sekmesi tek "Ana Renk" seçtirir (card #2233); diğer tüm tonlar buradan HSL
 * kaydırmalarıyla türetilir — THEME_PRESETS'teki elle seçilmiş paletlerin izlediği örüntüyle
 * (koyulaşan header gradyanı, çok koyu sidebar, çok açık arka plan) tutarlı kalacak şekilde.
 */
export function deriveAppearanceFromPrimary(primaryHex: string): Omit<TenantAppearance, 'themePreset' | 'isCustomized' | 'primaryColor' | 'logoUrl' | 'loginBackgroundImageUrl'> {
  const hsl = hexToHsl(primaryHex)
  if (!hsl) {
    const fallback = DEFAULT_TENANT_APPEARANCE
    return {
      secondaryColor: fallback.secondaryColor,
      accentColor: fallback.accentColor,
      neutralColor: fallback.neutralColor,
      surfaceColor: fallback.surfaceColor,
      backgroundColor: fallback.backgroundColor,
      headerGradientFrom: fallback.headerGradientFrom,
      headerGradientTo: fallback.headerGradientTo,
      sidebarBackgroundColor: fallback.sidebarBackgroundColor,
      sidebarForegroundColor: fallback.sidebarForegroundColor,
    }
  }

  const [h, s] = hsl
  return {
    secondaryColor: hslToHex(h, Math.min(100, s * 0.85), 52),
    accentColor: hslToHex(h + 35, Math.min(100, s * 0.6), 45),
    neutralColor: hslToHex(h, Math.min(100, s * 0.25), 36),
    surfaceColor: '#FFFFFF',
    backgroundColor: hslToHex(h, Math.min(100, s * 0.3), 96),
    headerGradientFrom: hslToHex(h, s, 25),
    headerGradientTo: hslToHex(h, Math.min(100, s * 0.7), 12),
    sidebarBackgroundColor: hslToHex(h, Math.min(100, s * 0.4), 9),
    sidebarForegroundColor: '#F7FAFC',
  }
}

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

export function applyTenantBrowserBranding(_appearance: TenantAppearance): void {
  if (typeof document === 'undefined') {
    return
  }

  // Browser icons are deployment assets, not tenant appearance assets. This
  // prevents a tenant's content logo URL from being requested by every tab.
  const iconUrl = '/favicon.png'
  const iconType = 'image/png'
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
